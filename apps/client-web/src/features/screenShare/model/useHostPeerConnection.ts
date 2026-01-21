import { useCallback, useEffect, useRef, useState } from 'react';
import type { Envelope } from '../../../shared/lib/signaling/envelope';
import { SignalingClient } from '../../../shared/lib/signaling/SignalingClient';

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
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const sigRef = useRef<SignalingClient | null>(null);

  const pendingRemoteIceRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSetRef = useRef(false);

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

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

  const handleEnvelope = useCallback(
    async (env: Envelope) => {
      // 라우팅 필터
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

  const start = useCallback(async () => {
    setStatus('connecting');
    setError('');

    const sig = new SignalingClient({ onMessage: handleEnvelope });
    sig.connect(wsUrl, token);
    sigRef.current = sig;

    // WS 라우팅 바인딩
    sig.sendMessage<SysAttachPayload>(
      'SYS_ATTACH',
      { channelId, sessionId, from: { role: 'HOST' } },
      { resume: false }
    );

    const pc = new RTCPeerConnection(
      rtcConfig ?? { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
    );
    pcRef.current = pc;

    remoteDescSetRef.current = false;
    pendingRemoteIceRef.current = [];

    // 로컬 트랙 추가
    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }

    // ICE - SIG_ICE
    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      sig.sendMessage<SigIcePayload>(
        'SIG_ICE',
        { channelId, sessionId, from: { role: 'HOST' } },
        {
          candidate: ev.candidate.candidate,
          sdpMid: ev.candidate.sdpMid,
          sdpMLineIndex: ev.candidate.sdpMLineIndex,
        }
      );
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setStatus('connected');
      if (pc.connectionState === 'failed') {
        setStatus('error');
        setError('PeerConnection failed');
      }
    };

    try {
      // Offer - LocalDesc - SIG_OFFER
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sig.sendMessage<SigOfferPayload>(
        'SIG_OFFER',
        { channelId, sessionId, from: { role: 'HOST' } },
        {
          sdpType: 'offer',
          sdp: pc.localDescription?.sdp ?? '',
        }
      );
    } catch {
      setStatus('error');
      setError('Offer 파이프라인 실패');
    }
  }, [wsUrl, token, channelId, sessionId, stream, rtcConfig, handleEnvelope]);

  const stop = useCallback(() => {
    sigRef.current?.close();
    sigRef.current = null;

    const pc = pcRef.current;
    pcRef.current = null;

    remoteDescSetRef.current = false;
    pendingRemoteIceRef.current = [];

    if (pc) {
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.close();
    }
    setStatus('idle');
  }, []);

  useEffect(() => stop, [stop]);

  return { start, stop, status, error };
}
