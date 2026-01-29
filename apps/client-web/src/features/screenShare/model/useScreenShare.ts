import { useCallback, useRef, useState } from 'react';
import { SignalingClient } from '../../../shared/lib/signaling/SignalingClient';
// Envelope import 제거 (불필요)
import type { ConnectionStatus } from '../../media/model/useConnectionStatus';

type Role = 'host' | 'viewer';
type InternalStatus = 'idle' | 'captured' | 'connecting' | 'connected' | 'error';

type ConnectArgs = {
  role: Role;
  stream?: MediaStream;
  wsUrl?: string;
  token?: string;
  channelId: string;
  sessionId: string;
};

// ... (mapToConnectionStatus 함수는 그대로 유지) ...
function mapToConnectionStatus(s: InternalStatus): ConnectionStatus {
  switch (s) {
    case 'idle': return 'idle';
    case 'captured':
    case 'connecting': return 'connecting';
    case 'connected': return 'connected';
    case 'error': return 'failed';
    default: return 'disconnected';
  }
}

export function useScreenShare() {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const scRef = useRef<SignalingClient | null>(null);
  const pendingRemoteIceRef = useRef<RTCIceCandidateInit[]>([]);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [internalStatus, setInternalStatus] = useState<InternalStatus>('idle');
  const [error, setError] = useState('');

  const cleanup = useCallback(() => {
    scRef.current?.close();
    scRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    pendingRemoteIceRef.current = [];
  }, []);

  const startCapture = useCallback(async () => {
    setError('');
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
      setLocalStream(s);
      setInternalStatus('captured');
      s.getVideoTracks()[0].onended = () => {
        s.getTracks().forEach((t) => t.stop());
        setLocalStream(null);
        setRemoteStream(null);
        cleanup();
        setInternalStatus('idle');
      };
      return s;
    } catch (e: any) {
      console.error('getDisplayMedia failed:', e);
      setError(`${e.name}: ${e.message}`);
      setInternalStatus('error');
      return null;
    }
  }, [cleanup]);

  const connect = useCallback(async (args: ConnectArgs) => {
    const { role, stream, wsUrl, token, channelId, sessionId } = args;
    setError('');
    setInternalStatus('connecting');

    if (!channelId || !sessionId || !wsUrl || !token) {
      setError('필수 연결 정보(channelId, sessionId, wsUrl, token)가 부족합니다.');
      setInternalStatus('error');
      return;
    }

    const outbound = role === 'host' ? (stream ?? localStream) : null;
    if (role === 'host' && !outbound) {
      setError('호스트는 화면 공유 스트림이 필요합니다.');
      setInternalStatus('error');
      return;
    }

    cleanup();

    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;

    if (role === 'viewer') {
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    const inbound = new MediaStream();
    setRemoteStream(inbound);

    pc.ontrack = (e) => {
      if (e.streams[0]) {
        e.streams[0].getTracks().forEach(t => inbound.addTrack(t));
        setRemoteStream(new MediaStream(inbound.getTracks()));
      }
    };

    if (role === 'host' && outbound) {
      outbound.getTracks().forEach(t => pc.addTrack(t, outbound));
    }

    const sc = new SignalingClient({
      channelId,
      sessionId,
      role: role === 'host' ? 'HOST' : 'GUEST',
      clientId: Math.random().toString(36).slice(2),
    }, {
      onOpen: async () => {
        if (role === 'host' || role === 'viewer') {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            // sdpType 타입 단언 (as "offer")
            sc.sendTyped('SIG_OFFER', {
              sdp: offer.sdp!,
              sdpType: offer.type as "offer"
            });
          } catch (e) {
            console.error('Offer creation failed', e);
            setError('Offer 생성 실패');
          }
        }
      },
      onInbound: async (msg) => {
        if (msg.type === 'SIG_ANSWER') {
          try {
            const sdp = (msg.payload as any).sdp;
            await pc.setRemoteDescription({ type: 'answer', sdp });

            const candidates = pendingRemoteIceRef.current;
            pendingRemoteIceRef.current = [];
            for (const c of candidates) await pc.addIceCandidate(c);

            setInternalStatus('connected');
          } catch (e) {
            console.error('Remote Desc Error', e);
            setError('Answer 처리 실패');
            setInternalStatus('error');
          }
        } else if (msg.type === 'SIG_ICE') {
          const candidate = (msg.payload as any).candidate;
          // ICE payload 구조에 맞춰 매핑 필요할 수 있음 (일단 candidate가 문자열로 오면 파싱 필요할 수도 있으나, 여기선 객체로 온다고 가정)
          // 만약 payload 자체가 RTCIceCandidateInit 형태라면 그대로 사용
          if (typeof candidate === 'string') {
            // payload 구조 확인 필요, 일단 candidate 필드가 있으면 시도
            const c = { candidate, sdpMid: (msg.payload as any).sdpMid, sdpMLineIndex: (msg.payload as any).sdpMLineIndex };
            await pc.addIceCandidate(c);
          } else if (candidate) {
            // 이미 객체라면
            if (pc.remoteDescription) {
              await pc.addIceCandidate(candidate);
            } else {
              pendingRemoteIceRef.current.push(candidate);
            }
          }
        }
      },
      onError: () => {
        setError('WebSocket 에러 발생');
        setInternalStatus('error');
      }
    });

    scRef.current = sc;

    pc.onicecandidate = (e) => {
      if (e.candidate && e.candidate.candidate) { // candidate 문자열 확인
        // candidate 객체 분해해서 전송
        sc.sendTyped('SIG_ICE', {
          candidate: e.candidate.candidate,
          sdpMid: e.candidate.sdpMid,
          sdpMLineIndex: e.candidate.sdpMLineIndex
        });
      }
    };

    sc.connect(wsUrl, token);

  }, [localStream, cleanup]);

  const stopAll = useCallback(() => {
    cleanup();
    localStream?.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    setRemoteStream(null);
    setInternalStatus('idle');
    setError('');
  }, [localStream, cleanup]);

  return { localStream, remoteStream, status: mapToConnectionStatus(internalStatus), error, startCapture, connect, stopAll };
}