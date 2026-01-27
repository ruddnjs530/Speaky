import { useCallback, useRef, useState } from 'react';
import { sendOfferWS, sendIceWS, sendAttachWS } from '../api/signaling';
import { SignalingClient } from '../../../shared/lib/signaling/SignalingClient';
import type { Envelope, Role as EnvelopeRole } from '../../../shared/lib/signaling/envelope';

import type { ConnectionStatus } from '../../media/model/useConnectionStatus';

type Role = 'host' | 'viewer';
type InternalStatus = 'idle' | 'captured' | 'connecting' | 'connected' | 'error';

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

function mapToConnectionStatus(s: InternalStatus): ConnectionStatus {
  switch (s) {
    case 'idle':
      return 'idle';
    case 'captured':
    case 'connecting':
      return 'connecting';
    case 'connected':
      return 'connected';
    case 'error':
      return 'failed';
    default:
      return 'disconnected';
  }
}

export function useScreenShare() {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<SignalingClient | null>(null);

  const pendingRemoteIceRef = useRef<RTCIceCandidateInit[]>([]);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // ✅ 내부 상태는 훅 내부에서만 사용
  const [internalStatus, setInternalStatus] = useState<InternalStatus>('idle');
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
      setInternalStatus('captured');

      const [vt] = s.getVideoTracks();
      if (vt) {
        vt.onended = () => {
          s.getTracks().forEach((t) => t.stop());
          setLocalStream(null);
          setRemoteStream(null);
          cleanup();
          setInternalStatus('idle');
        };
      }

      return s;
    } catch (e) {
      console.error('getDisplayMedia failed:', e);
      const err = e as DOMException;
      setError(`${err.name}: ${err.message}`);
      setInternalStatus('error');
      return null;
    }
  }, [cleanup]);

  const connect = useCallback(
      async ({ role, stream, wsUrl, token, channelId, sessionId }: ConnectArgs) => {
        setError('');
        setInternalStatus('connecting');

        if (!channelId || !sessionId) {
          setError('channelId/sessionId가 필요해요. (REST 응답으로 받아오세요)');
          setInternalStatus('error');
          return;
        }
        if (!wsUrl) {
          setError('wsUrl이 필요해요. (REST 응답으로 받아오세요)');
          setInternalStatus('error');
          return;
        }
        if (!token) {
          setError('token(signalingToken)이 필요해요. (REST 응답으로 받아오세요)');
          setInternalStatus('error');
          return;
        }

        const envelopeRole: EnvelopeRole = role === 'host' ? 'HOST' : 'GUEST';

        const outbound = role === 'host' ? (stream ?? localStream) : null;
        if (role === 'host' && !outbound) {
          setError('호스트는 먼저 화면 공유를 시작해야 해요.');
          setInternalStatus('error');
          return;
        }

        cleanup();

        const pc = new RTCPeerConnection({
          // TODO(Day3-B): 최종적으로는 REST 응답의 rtcConfig.iceServers를 주입하는 형태로 교체 권장
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
          let settled = false;

          const sc = new SignalingClient({
            onOpen: () => {
              if (settled) return;
              settled = true;
              resolve();
            },
            onClose: (ev) => {
              // 연결 시도 중 닫히면 실패 처리
              if (!settled) {
                settled = true;
                reject(new Error(`WS closed: ${ev.code} ${ev.reason}`));
                return;
              }
              // 연결 이후 close는 여기서 굳이 reject하지 않음
            },
            onError: () => {
              if (settled) return;
              settled = true;
              reject(new Error('WS error'));
            },
            onMessage: async (env: Envelope) => {
              if (env.type === 'SYS_ERROR') {
                const payload = env.payload as { code?: string; msg?: string } | undefined;
                const code = payload?.code ?? 'WS_ERROR';
                const msg = payload?.msg ?? 'WebSocket 오류가 발생했습니다.';

                setError(`${code}: ${msg}`);
                setInternalStatus('error');

                cleanup();
                setRemoteStream(null);
                return;
              }

              if (env.type === 'SYS_ACK') return;

              if (env.type === 'SIG_SDP_ANSWER') {
                try {
                  const payload = env.payload as AnswerPayload | undefined;
                  if (!payload?.sdp) return;

                  await pc.setRemoteDescription(payload.sdp);

                  const pending = pendingRemoteIceRef.current;
                  pendingRemoteIceRef.current = [];
                  for (const c of pending) {
                    try {
                      await pc.addIceCandidate(c);
                    } catch (err) {
                      console.debug('addIceCandidate ignored:', err);
                    }
                  }

                  setInternalStatus('connected');
                } catch (err) {
                  console.error('apply answer failed:', err);
                  setError('Answer 적용에 실패했어요.');
                  setInternalStatus('error');
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

                try {
                  await pc.addIceCandidate(cand);
                } catch (err) {
                  console.debug('addIceCandidate ignored:', err);
                }
                return;
              }
            },
          });

          wsRef.current = sc;
          sc.setContext({
            channelId,
            sessionId,
            from: { role: 'SC' },
          });

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

          const sc = wsRef.current;
          if (!sc) throw new Error('WS client not ready');

          // 규약: 첫 메시지는 SYS_ATTACH
          sendAttachWS(sc, { channelId, sessionId, role: envelopeRole }, { resume: false });

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          sendOfferWS(sc, offer, { channelId, sessionId, role: envelopeRole });
        } catch (err) {
          console.error('connect failed:', err);
          setError('서버 연결(WS/Offer)에 실패했어요.');
          setInternalStatus('error');
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
    setInternalStatus('idle');
    setError('');
  }, [localStream]);

  // ✅ 외부에 노출하는 status는 ConnectionStatus로 통일
  const status: ConnectionStatus = mapToConnectionStatus(internalStatus);

  return { localStream, remoteStream, status, error, startCapture, connect, stopAll };
}
