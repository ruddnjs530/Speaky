import { useCallback, useRef, useState } from 'react';
import { SignalingClient } from '../../../shared/lib/signaling/SignalingClient';
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
            console.log('Received Answer SDP:', sdp);
            console.log('Current Signaling State:', pc.signalingState);

            await pc.setRemoteDescription({ type: 'answer', sdp });

            const candidates = pendingRemoteIceRef.current;
            pendingRemoteIceRef.current = [];
            for (const c of candidates) await pc.addIceCandidate(c);

            setInternalStatus('connected');
          } catch (e) {
            console.error('Remote Desc Error Details:', e);
            console.error('Failed SDP:', (msg.payload as any).sdp);
            setError('Answer 처리 실패');
            setInternalStatus('error');
          }
        } else if (msg.type === 'SIG_ICE') {
          const candidateInit = msg.payload as RTCIceCandidateInit;
          if (candidateInit.candidate) {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(candidateInit);
            } else {
              pendingRemoteIceRef.current.push(candidateInit);
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