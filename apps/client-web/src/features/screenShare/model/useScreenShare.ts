import { useCallback, useRef, useState } from 'react';
import { sendOfferWS, sendIceWS } from '../api/signaling';
import { SignalingClient } from '../../../shared/lib/signaling/SignalingClient';
import type { Envelope, Role as EnvelopeRole } from '../../../shared/lib/signaling/envelope';

type Role = 'host' | 'viewer';
type Status = 'idle' | 'captured' | 'connecting' | 'connected' | 'error';

type ConnectArgs = {
  role: Role;
  stream?: MediaStream;      
  roomId?: string;         

  wsUrl?: string;         
  token?: string;     
  channelId?: string;
  sessionId?: string;
};

type AnswerPayload = { sdp: RTCSessionDescriptionInit };
type IcePayload = { candidate: RTCIceCandidateInit };

export function useScreenShare() {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<SignalingClient | null>(null);

  const pendingRemoteIceRef = useRef<RTCIceCandidateInit[]>([]);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  const cleanup = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;

    pcRef.current?.close();
    pcRef.current = null;

    pendingRemoteIceRef.current = [];
  }, []);

  const startCapture = useCallback(async () => {
    setError('');
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });

      setLocalStream(s);
      setStatus('captured');

      const [vt] = s.getVideoTracks();
      if (vt) {
        vt.onended = () => {
          s.getTracks().forEach((t) => t.stop());
          setLocalStream(null);
          setRemoteStream(null);
          cleanup();
          setStatus('idle');
        };
      }

      return s;
    } catch (e) {
      console.error('getDisplayMedia failed:', e);
      const err = e as DOMException;
      setError(`${err.name}: ${err.message}`);
      setStatus('error');
      return null;
    }
  }, [cleanup]);

  const connect = useCallback(
    async ({ role, stream, wsUrl, token, channelId, sessionId }: ConnectArgs) => {
      setError('');
      setStatus('connecting');

      if (!channelId || !sessionId) {
        setError('channelId/sessionId가 필요해요. (REST 응답으로 받아오세요)');
        setStatus('error');
        return;
      }
      if (!wsUrl) {
        setError('wsUrl이 필요해요. (REST 응답으로 받아오세요)');
        setStatus('error');
        return;
      }
      if (!token) {
        setError('token(signalingToken)이 필요해요. (REST 응답으로 받아오세요)');
        setStatus('error');
        return;
      }

      const envelopeRole: EnvelopeRole = role === 'host' ? 'HOST' : 'GUEST';

      const outbound = role === 'host' ? (stream ?? localStream) : null;
      if (role === 'host' && !outbound) {
        setError('호스트는 먼저 화면 공유를 시작해야 해요.');
        setStatus('error');
        return;
      }

      cleanup();

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      if (role === 'viewer') {
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }

      const inbound = new MediaStream();
      setRemoteStream(inbound);

      pc.ontrack = (e) => {
        const s0 = e.streams[0];
        if (!s0) return;
        s0.getTracks().forEach((t) => inbound.addTrack(t));
        setRemoteStream(new MediaStream(inbound.getTracks()));
      };

      if (role === 'host' && outbound) {
        outbound.getTracks().forEach((t) => pc.addTrack(t, outbound));
      }

      const wsReady = new Promise<void>((resolve, reject) => {
        const sc = new SignalingClient({
          onOpen: () => resolve(),
          onClose: (ev) => reject(new Error(`WS closed: ${ev.code} ${ev.reason}`)),
          onError: () => reject(new Error('WS error')),
          onMessage: async (env: Envelope) => {
            if (env.type === 'SIG_SDP_ANSWER') {
              try {
                const payload = env.payload as AnswerPayload | undefined;
                if (!payload?.sdp) return;

                await pc.setRemoteDescription(payload.sdp);

                const pending = pendingRemoteIceRef.current;
                pendingRemoteIceRef.current = [];
                for (const c of pending) {
                  try { await pc.addIceCandidate(c); } catch {}
                }

                setStatus('connected');
              } catch (err) {
                console.error('apply answer failed:', err);
                setError('Answer 적용에 실패했어요.');
                setStatus('error');
                cleanup();
                setRemoteStream(null);
              }
              return;
            }

            if (env.type === 'SIG_ICE') {
              const payload = env.payload as IcePayload | undefined;
              const cand = payload?.candidate;
              if (!cand) return;

              if (!pc.remoteDescription) {
                pendingRemoteIceRef.current.push(cand);
                return;
              }

              try { await pc.addIceCandidate(cand); } catch {}
              return;
            }
          },
        });

        wsRef.current = sc;
        sc.connect(wsUrl, token);
      });

      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        const sc = wsRef.current;
        if (!sc) return;

        sendIceWS(sc, e.candidate.toJSON(), {
          channelId,
          sessionId,
          role: envelopeRole,
        });
      };

      try {
        await wsReady;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const sc = wsRef.current;
        if (!sc) throw new Error('WS client not ready');

        sendOfferWS(sc, offer, {
          channelId,
          sessionId,
          role: envelopeRole,
        });
      } catch (err) {
        console.error('connect failed:', err);
        setError('서버 연결(WS/Offer)에 실패했어요.');
        setStatus('error');
        cleanup();
        setRemoteStream(null);
      }
    },
    [localStream, cleanup]
  );


  const stopAll = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;

    wsRef.current?.close();
    wsRef.current = null;

    localStream?.getTracks().forEach((t) => t.stop());

    setLocalStream(null);
    setRemoteStream(null);
    setStatus('idle');
    setError('');
  }, [localStream]);

  return { localStream, remoteStream, status, error, startCapture, connect, stopAll };
}
