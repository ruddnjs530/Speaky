import { useCallback, useEffect, useRef, useState } from 'react';
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
  clientId?: string;
  isResume?: boolean;
  onMessage?: (msg: any) => void;
};

function mapToConnectionStatus(s: InternalStatus): ConnectionStatus {
  switch (s) {
    case 'idle':
    case 'captured': return 'idle'; // 화면만 공유된 상태는 아직 연결 전이므로 idle로 취급
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

  // localStream의 트랙 종료를 위해 ref 사용 (stopAll의 의존성을 제거하기 위함)
  const localStreamRef = useRef<MediaStream | null>(null);

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
      localStreamRef.current = s; // Ref 동기화

      setInternalStatus('captured');
      s.getVideoTracks()[0].onended = () => {
        s.getTracks().forEach((t) => t.stop());
        setLocalStream(null);
        localStreamRef.current = null;
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

  // ... connect ... (omitted, no change needed if it only reads state, but wait, connect reads localStream)
  // connect also needs to use the stream passed in args OR localStream.
  // connect dependency list has [localStream].
  // If we change connect to use localStreamRef, we can remove dependency?
  // But connect is usually called ONCE.
  // Let's check connect signature. It takes 'stream' arg.
  // The 'connect' function uses: `const outbound = role === 'host' ? (stream ?? localStream) : null;`
  // Use `localStreamRef.current` there too to be safe?
  // But purely for `stopAll` stability, we just need `stopAll` changed.

  const connect = useCallback(async (args: ConnectArgs) => {
    const { role, stream, wsUrl, token, channelId, sessionId, clientId, isResume } = args;
    setError('');
    setInternalStatus('connecting');

    if (!channelId || !sessionId || !wsUrl || !token) {
      setError('필수 연결 정보(channelId, sessionId, wsUrl, token)가 부족합니다.');
      setInternalStatus('error');
      return;
    }

    // localStream 대신 ref 사용 (의존성 제거)
    const outbound = role === 'host' ? (stream ?? localStreamRef.current) : null;
    if (role === 'host' && !outbound) {
      setError('호스트는 화면 공유 스트림이 필요합니다.');
      setInternalStatus('error');
      return;
    }

    cleanup();

    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;

    // 역할에 따른 트랜시버 구성
    if (role === 'viewer') {
      // 시청자는 수신만 함
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });
    } else if (role === 'host') {
      // 호스트는 송수신 모두 수행 (서버에서 처리된 미디어를 다시 받기 위함)
      pc.addTransceiver('video', { direction: 'sendrecv' });
      pc.addTransceiver('audio', { direction: 'sendrecv' });
    }

    const inbound = new MediaStream();
    setRemoteStream(inbound);

    pc.ontrack = (e) => {
      console.log('ontrack event:', e.track.kind, e.streams.length);
      if (e.streams[0]) {
        console.log('ontrack stream id:', e.streams[0].id);
        e.streams[0].getTracks().forEach(t => {
          // 중복 방지: 이미 추가된 트랙인지 확인
          if (!inbound.getTracks().find(track => track.id === t.id)) {
            inbound.addTrack(t);
            console.log('Track added:', t.kind, 'Total tracks:', inbound.getTracks().length);
          }
        });
        // MediaStream 객체를 재생성하지 않고 기존 inbound 사용
        // setRemoteStream은 이미 위에서 한 번만 호출됨
      }
    };

    if (role === 'host' && outbound) {
      outbound.getTracks().forEach(t => pc.addTrack(t, outbound));
    }

    const sc = new SignalingClient({
      channelId,
      sessionId,
      role: role === 'host' ? 'HOST' : 'GUEST',
      clientId: clientId || Math.random().toString(36).slice(2),
    }, {
      initialResume: isResume,
      onOpen: async () => {
        console.log('[useScreenShare] STOMP onOpen occurred. Waiting for SYS_ACK to send Offer...');
      },
      onInbound: async (msg) => {
        console.log('[useScreenShare] Received Inbound Message:', msg.type);

        // 외부 핸들러 호출
        if (args.onMessage) {
          args.onMessage(msg);
        }

        // [수정] SYS_ACK 수신 시: 이미 연결된 상태(stable)가 아니거나, 아직 Offer를 안 보낸 경우에만 Offer 전송
        if (msg.type === 'SYS_ACK') {
          // 이미 연결 수립된 상태라면 추가 Offer 보내지 않음 (Renegotiation 필요한 경우 별도 처리)
          if (pc.signalingState === 'stable' && pcRef.current?.remoteDescription) {
            return;
          }

          if (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer') {
            // 혹시라도 이미 진행 중이면 스킵
            if (pc.localDescription) {
              return;
            }
          }

          try {
            console.log('[useScreenShare] Creating Offer...');
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sc.sendTyped('SIG_OFFER', {
              sdp: offer.sdp!,
              sdpType: offer.type as "offer"
            });
          } catch (e) {
            console.error('[useScreenShare] Offer creation failed', e);
            setError('Offer 생성 실패');
          }
        }

        if (msg.type === 'SIG_ANSWER') {
          if (pc.signalingState === 'stable') {
            console.warn('[useScreenShare] Received Answer in stable state. Ignoring duplicate answer.');
            return;
          }
          if (pc.signalingState !== 'have-local-offer') {
            console.warn(`[useScreenShare] Received Answer in wrong state: ${pc.signalingState}. Ignoring.`);
            return;
          }

          try {
            const sdp = (msg.payload as any).sdp;

            await pc.setRemoteDescription({ type: 'answer', sdp });

            const candidates = pendingRemoteIceRef.current;
            pendingRemoteIceRef.current = [];
            for (const c of candidates) await pc.addIceCandidate(c);

            console.log('[useScreenShare] Connection established (SIG_ANSWER processed)');
            setInternalStatus('connected');
          } catch (e) {
            console.error('Remote Desc Error Details:', e);
            setError('Answer 처리 실패');
            setInternalStatus('error');
          }
        } else if (msg.type === 'SIG_ICE') {
          const candidateInit = msg.payload as RTCIceCandidateInit;
          console.log('[useScreenShare] Received ICE Candidate');
          if (candidateInit.candidate) {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(candidateInit);
            } else {
              pendingRemoteIceRef.current.push(candidateInit);
            }
          }
        } else if (msg.type === 'SYS_ERROR') {
          console.error('[useScreenShare] Received SYS_ERROR:', msg.payload);
          const code = (msg.payload as any)?.code;
          const message = (msg.payload as any)?.message || 'Signaling Error';
          setError(`서버 에러: ${code} - ${message}`);
          setInternalStatus('error');
        }
      },
      onError: (ev) => {
        console.error('[useScreenShare] STOMP onError:', ev);
        setError('WebSocket 에러 발생');
        setInternalStatus('error');
      },
      onClose: (code, reason) => {
        console.warn('[useScreenShare] STOMP onClose:', code, reason);
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

  }, [cleanup]); // localStream 의존성 제거

  // 정리(Clean up)를 위한 Interval Ref
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (internalStatus === 'connected' && pcRef.current) {
      const pc = pcRef.current;
      statsIntervalRef.current = setInterval(async () => {
        try {
          const stats = await pc.getStats();
          let rtt = null;
          for (const report of stats.values()) {
            if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.currentRoundTripTime) {
              rtt = report.currentRoundTripTime * 1000;
              break; // 찾으면 즉시 루프 종료 (최적화)
            }
          }
          if (rtt !== null) setLatency(Math.round(rtt));
        } catch (e) { /* ignore */ }
      }, 2000);
    }

    return () => {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    };
  }, [internalStatus]);

  const stopAll = useCallback(() => {
    cleanup();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    localStreamRef.current = null;
    setRemoteStream(null);
    setInternalStatus('idle');
    setError('');
    setLatency(null);
  }, [cleanup]);

  const [latency, setLatency] = useState<number | null>(null);

  return { localStream, remoteStream, status: mapToConnectionStatus(internalStatus), error, startCapture, connect, stopAll, latency };
}