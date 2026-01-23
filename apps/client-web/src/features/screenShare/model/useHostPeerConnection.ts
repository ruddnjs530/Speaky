import { useCallback, useEffect, useRef, useState } from 'react';
import type { Envelope } from '../../../shared/lib/signaling/envelope';
import { SignalingClient } from '../../../shared/lib/signaling/SignalingClient';
import type { SendOpts } from '../../../shared/lib/signaling/SignalingClient';
import { HostPeerController } from '../api/HostPeerController';

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
type SysErrorPayload = { code: string; msg?: string };

export function useHostPeerConnection({
  wsUrl,
  token,
  channelId,
  sessionId,
  stream,
  rtcConfig,
}: Args) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  const sigRef = useRef<SignalingClient | null>(null);
  const hostCtrlRef = useRef<HostPeerController | null>(null);

  // sendOpts는 props 변경(특히 channelId/sessionId)에도 안전하게 최신화
  const sendOptsRef = useRef<SendOpts>({
    channelId,
    sessionId,
    from: { role: 'HOST' },
  });

  useEffect(() => {
    sendOptsRef.current = {
      channelId,
      sessionId,
      from: { role: 'HOST' },
    };
  }, [channelId, sessionId]);

  const handleEnvelope = useCallback(
    async (env: Envelope) => {
      // 라우팅 필터
      if (env.channelId !== channelId) return;
      if (env.sessionId !== sessionId) return;

      // SYS_ERROR는 훅에서 즉시 UI 반영
      if (env.type === 'SYS_ERROR') {
        const p = env.payload as SysErrorPayload | undefined;
        setStatus('error');
        setError(p?.msg ? `${p.code}: ${p.msg}` : p?.code ?? 'SYS_ERROR');
        return;
      }

      // 나머지(ANSWER/ICE 등)는 컨트롤러로 위임
      const ctrl = hostCtrlRef.current;
      if (!ctrl) return;

      try {
        await ctrl.handleEnvelope(env);
      } catch {
        setStatus('error');
        setError('시그널링 처리 실패');
      }
    },
    [channelId, sessionId],
  );

  const start = useCallback(async () => {
    // 이미 구동 중이면 중복 시작 방지
    if (status === 'connecting' || status === 'connected') return;

    setStatus('connecting');
    setError('');

    // 혹시 남아있는 인스턴스가 있으면 정리
    hostCtrlRef.current?.stop();
    hostCtrlRef.current = null;
    sigRef.current?.close();
    sigRef.current = null;

    const sig = new SignalingClient({
      onMessage: handleEnvelope,
      onOpen: () => {
        // WS open 자체가 connected는 아니므로 status는 유지
      },
      onClose: () => {
        // 끊겼다면 컨트롤러가 PC를 재협상/재생성하는 동안 connecting 유지
        if (status !== 'idle') setStatus('connecting');
      },
      onError: () => {
        // onClose에서 재연결이 일어나므로 여기서 즉시 error로 내리지 않음(필요 시 정책 변경)
      },
    });

    // 자동 SYS_* 컨텍스트(재연결 시 resume attach 등)에 사용
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

    // 최초 attach (resume:false) — 기존 흐름 유지
    try {
      sig.sendMessage<SysAttachPayload>(
        'SYS_ATTACH',
        { channelId, sessionId, from: { role: 'HOST' } },
        { resume: false },
      );
    } catch {
      setStatus('error');
      setError('SYS_ATTACH 전송 실패');
      return;
    }

    // HostPeerController 생성/시작
    const ctrl = new HostPeerController({
      signaling: sig,
      sendOpts: sendOptsRef.current,
      rtcConfig: rtcConfig ?? { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
      getLocalStream: () => stream,
      onPcState: (s) => {
        if (s === 'connected') setStatus('connected');
        if (s === 'failed' || s === 'disconnected') {
          // 컨트롤러가 즉시 재생성/재협상을 시작할 것이므로 connecting 유지
          setStatus('connecting');
        }
      },
    });

    hostCtrlRef.current = ctrl;

    try {
      await ctrl.start(); // offer부터 시작
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
