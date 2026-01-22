import { useCallback, useEffect, useRef, useState } from 'react';
import type { Envelope } from '../../../shared/lib/signaling/envelope';
import { SignalingClient } from '../../../shared/lib/signaling/SignalingClient';

type Status = 'idle' | 'connecting' | 'connected' | 'error';

type Args = {
  wsUrl: string;
  token: string;
  channelId: string;
  sessionId: string;
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

export function useViewerPeerConnection({
  wsUrl,
  token,
  channelId,
  sessionId,
  rtcConfig,
}: Args) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const sigRef = useRef<SignalingClient | null>(null);

  const pendingRemoteIceRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSetRef = useRef(false);

  const remoteStreamRef = useRef<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  // start() 중복 호출 방지
  const startingRef = useRef(false);

  // WS open 전에는 ICE를 보내면 안 되므로 큐잉
  const pendingLocalIceRef = useRef<SigIcePayload[]>([]);
  const wsReadyRef = useRef(false);

  const flushPendingRemoteIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;

    const list = pendingRemoteIceRef.current;
    if (list.length === 0) return;

    for (const c of list) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        // ignore
      }
    }
    pendingRemoteIceRef.current = [];
  }, []);

  const flushPendingLocalIce = useCallback(() => {
    const sig = sigRef.current;
    if (!sig) return;
    const list = pendingLocalIceRef.current;
    if (list.length === 0) return;

    for (const ice of list) {
      try {
        sig.sendMessage<SigIcePayload>(
          'SIG_ICE',
          { channelId, sessionId, from: { role: 'GUEST' } },
          ice
        );
      } catch {
        // ignore
      }
    }
    pendingLocalIceRef.current = [];
  }, [channelId, sessionId]);

  const handleEnvelope = useCallback(
    async (env: Envelope) => {
      if (env.channelId !== channelId) return;
      if (env.sessionId !== sessionId) return;

      const pc = pcRef.current;
      if (!pc) return;

      if (env.type === 'SYS_ERROR') {
        const p = env.payload as SysErrorPayload | undefined;
        setStatus('error');
        setError(p?.msg ? `${p.code}: ${p.msg}` : p?.code ?? 'SYS_ERROR');
        return;
      }

      if (env.type === 'SIG_ANSWER') {
        const p = env.payload as SigAnswerPayload | undefined;
        if (!p?.sdp) return;

        try {
          await pc.setRemoteDescription({ type: p.sdpType, sdp: p.sdp });
          remoteDescSetRef.current = true;
          await flushPendingRemoteIce();
          setStatus('connected');
        } catch {
          setStatus('error');
          setError('setRemoteDescription 실패');
        }
        return;
      }

      if (env.type === 'SIG_ICE') {
        const p = env.payload as SigIcePayload | undefined;
        if (!p?.candidate) return;

        const ice: RTCIceCandidateInit = {
          candidate: p.candidate,
          sdpMid: p.sdpMid ?? undefined,
          sdpMLineIndex: p.sdpMLineIndex ?? undefined,
        };

        // Answer 전이면 큐잉
        if (!remoteDescSetRef.current) {
          pendingRemoteIceRef.current.push(ice);
          return;
        }

        try {
          await pc.addIceCandidate(ice);
        } catch {
          // ignore
        }
      }
    },
    [channelId, sessionId, flushPendingRemoteIce]
  );

  const buildPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(
      rtcConfig ?? { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
    );

    pcRef.current = pc;
    remoteDescSetRef.current = false;
    pendingRemoteIceRef.current = [];
    remoteStreamRef.current = null;
    setRemoteStream(null);

    // Viewer는 수신만
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });

    pc.ontrack = (ev) => {
      const track = ev.track;

      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
        setRemoteStream(remoteStreamRef.current);
      }
      remoteStreamRef.current.addTrack(track);
    };

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;

      const icePayload: SigIcePayload = {
        candidate: ev.candidate.candidate,
        sdpMid: ev.candidate.sdpMid,
        sdpMLineIndex: ev.candidate.sdpMLineIndex,
      };

      // WS 준비 전이면 로컬 ICE도 큐잉
      if (!wsReadyRef.current) {
        pendingLocalIceRef.current.push(icePayload);
        return;
      }

      try {
        sigRef.current?.sendMessage<SigIcePayload>(
          'SIG_ICE',
          { channelId, sessionId, from: { role: 'GUEST' } },
          icePayload
        );
      } catch {
        // ignore
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setStatus('connected');
      if (pc.connectionState === 'failed') {
        setStatus('error');
        setError('PeerConnection failed');
      }
    };

    return pc;
  }, [rtcConfig, channelId, sessionId]);

  const sendOffer = useCallback(async () => {
    const pc = pcRef.current;
    const sig = sigRef.current;
    if (!pc || !sig) return;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    sig.sendMessage<SigOfferPayload>(
      'SIG_OFFER',
      { channelId, sessionId, from: { role: 'GUEST' } },
      { sdpType: 'offer', sdp: pc.localDescription?.sdp ?? '' }
    );
  }, [channelId, sessionId]);

  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;

    setStatus('connecting');
    setError('');

    // 초기화
    wsReadyRef.current = false;
    pendingLocalIceRef.current = [];

    // WS 연결, onOpen에서부터 “first message = SYS_ATTACH” 보장
    const sig = new SignalingClient({
      onOpen: async () => {
        wsReadyRef.current = true;

        try {
          // 반드시 첫 메시지: SYS_ATTACH
          sig.sendMessage<SysAttachPayload>(
            'SYS_ATTACH',
            { channelId, sessionId, from: { role: 'GUEST' } },
            { resume: false }
          );

          // WS 준비가 끝났으니, 그동안 모인 로컬 ICE flush
          flushPendingLocalIce();

          // PC 만들고 Offer 전송
          buildPeerConnection();
          await sendOffer();
        } catch {
          setStatus('error');
          setError('WS attach / offer 파이프라인 실패');
        }
      },
      onMessage: handleEnvelope,
      onClose: () => {
      },
      onError: () => {
        setStatus('error');
        setError('WebSocket error');
      },
    });

    sigRef.current = sig;
    try {
      sig.connect(wsUrl, token);
    } catch {
      setStatus('error');
      setError('WebSocket connect 실패');
      startingRef.current = false;
      return;
    }

    startingRef.current = false;
  }, [
    wsUrl,
    token,
    channelId,
    sessionId,
    handleEnvelope,
    buildPeerConnection,
    sendOffer,
    flushPendingLocalIce,
  ]);

  const stop = useCallback(() => {
    // WS 정리
    sigRef.current?.close();
    sigRef.current = null;

    wsReadyRef.current = false;
    pendingLocalIceRef.current = [];

    // PC 정리
    const pc = pcRef.current;
    pcRef.current = null;

    remoteDescSetRef.current = false;
    pendingRemoteIceRef.current = [];

    remoteStreamRef.current?.getTracks().forEach((t) => t.stop());
    remoteStreamRef.current = null;
    setRemoteStream(null);

    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
    }

    setStatus('idle');
  }, []);

  useEffect(() => stop, [stop]);

  return { start, stop, status, error, remoteStream };
}
