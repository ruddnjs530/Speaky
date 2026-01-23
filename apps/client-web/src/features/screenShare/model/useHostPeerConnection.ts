import { useCallback, useEffect, useRef, useState } from 'react';
import type { Envelope } from '../../../shared/lib/signaling/envelope';
import { SignalingClient } from '../../../shared/lib/signaling/SignalingClient';
import type { SendOpts } from '../../../shared/lib/signaling/SignalingClient';
import { HostPeerController } from '../../../features/screenShare/api/HostPeerController';

type Status = 'idle' | 'connecting' | 'connected' | 'error';

type Args = {
  wsUrl: string;
  token: string;
  channelId: string;
  sessionId: string;
  stream: MediaStream;
  rtcConfig?: RTCConfiguration;
};

type SysAttachPayload = { resume?: boolean };

type SigOfferPayload = { sdpType: 'offer'; sdp: string };
type SigAnswerPayload = { sdpType: 'answer'; sdp: string };
type SigIcePayload = {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
};

type SysErrorPayload = { code: string; msg?: string };

export function useHostPeerConnection({
  wsUrl,
  token,
  channelId,
  sessionId,
  stream,
  rtcConfig,
}: Args) {
  const sigRef = useRef<SignalingClient | null>(null);
  const hostCtrlRef = useRef<HostPeerController | null>(null);

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  const sendOptsRef = useRef<SendOpts>({
    channelId,
    sessionId,
    from: { role: 'HOST' },
  });

  // sendOpts 최신화 (props 변경 대응)
  useEffect(() => {
    sendOptsRef.current = { channelId, sessionId, from: { role: 'HOST' } };
  }, [channelId, sessionId]);

  const handleEnvelope = useCallback(
    async (env: Envelope) => {
      // 라우팅 필터
      if (env.channelId !== channelId) return;
      if (env.sessionId !== sessionId) return;

      // SYS_ERROR는 훅에서 처리
      if (env.type === 'SYS_ERROR') {
        const p = env.payload as SysErrorPayload | undefined;
        setStatus('error');
        setError(p?.msg ? `${p.code}: ${p.msg}` : p?.code ?? 'SYS_ERROR');
        return;
      }

      // 나머지 (Answer/ICE 등)는 컨트롤러로 위임
      const ctrl = hostCtrlRef.current;
      if (!ctrl) return;
      await ctrl.handleEnvelope(env);
    },
    [channelId, sessionId]
  );

  const start = useCallback(async () => {
    setStatus('connecting');
    setError('');

    // WS
    const sig = new SignalingClient(
      {
        onMessage: handleEnvelope,
        onOpen: () => {
          // 열렸다고 바로 connected는 아님
          // 필요하면 여기서 UI 상태 갱신 가능
        },
        onClose: () => {
          if (status !== 'idle') setStatus('connecting');
        },
      },

    );

    // 자동 SYS_* (PING/PONG, 재연결 attach resume:true)에 쓸 컨텍스트
    sig.setContext({
      channelId,
      sessionId,
      from: { role: 'HOST' },
    });

    try {
      sig.connect(wsUrl, token);
    } catch {
      setStatus('error');
      setError('WebSocket connect 실패');
      return;
    }

    sigRef.current = sig;

    // 최초 attach (resume:false) — 너희 기존 흐름 유지
    sig.sendMessage<SysAttachPayload>(
      'SYS_ATTACH',
      { channelId, sessionId, from: { role: 'HOST' } },
      { resume: false }
    );

    // HostPeerController 생성/시작
    // - 끊김 시 PC 재생성, offer부터 재시작 정책은 컨트롤러가 책임
    const ctrl = new HostPeerController({
      signaling: sig,
      sendOpts: sendOptsRef.current,
      rtcConfig: rtcConfig ?? { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },

      // stream은 인자로 들어온 걸 그대로 사용
      getLocalStream: () => stream,

      onPcState: (s) => {
        if (s === 'connected') setStatus('connected');
        if (s === 'failed' || s === 'disconnected') {
          // 컨트롤러가 즉시 재생성, 재협상을 시작할 것이므로
          setStatus('connecting');
        }
      },
    });

    hostCtrlRef.current = ctrl;

    try {
      await ctrl.start(); // offer부터 시작
      // connected는 Answer 들어오거나 pc 상태로 바뀔 때 찍힘
    } catch {
      setStatus('error');
      setError('PeerConnection 시작 실패');
      return;
    }
  }, [wsUrl, token, channelId, sessionId, stream, rtcConfig, handleEnvelope, status]);

  const stop = useCallback(() => {
    hostCtrlRef.current?.stop();
    hostCtrlRef.current = null;

    sigRef.current?.close();
    sigRef.current = null;

    setStatus('idle');
    setError('');
  }, []);

  useEffect(() => stop, [stop]);

  return { start, stop, status, error };
}
