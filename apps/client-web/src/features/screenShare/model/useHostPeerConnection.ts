import { useCallback, useEffect, useRef, useState } from 'react';
import type { Envelope } from '../../../shared/lib/signaling/envelope';
import { SignalingClient } from '../../../shared/lib/signaling/SignalingClient';
import { applySignalingEnvelope } from './applySignaling';


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
type SigIcePayload = {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
};

// NOTE(Day4): 현재는 useScreenShare 통합 구현을 사용 중이라 미사용.
// 향후 signaling/webrtc 책임 분리 시(Host/Viewer 분리) 재사용 예정.
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

  // WS open 전에는 메시지 전송(attach/ice/offer)이 위험하므로 상태 관리
  const wsReadyRef = useRef(false);
  const pendingLocalIceRef = useRef<SigIcePayload[]>([]);

  const flushPendingLocalIce = useCallback(() => {
    const sig = sigRef.current;
    if (!sig) return;

    const list = pendingLocalIceRef.current;
    if (list.length === 0) return;

    for (const ice of list) {
      try {
        sig.sendMessage<SigIcePayload>(
            'SIG_ICE',
            { channelId, sessionId, from: { role: 'HOST' } },
            ice
        );
      } catch {
        // ignore
      }
    }
    pendingLocalIceRef.current = [];
  }, [channelId, sessionId]);


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
        const pc = pcRef.current;
        if (!pc) return;

        try {
          await applySignalingEnvelope(env, {
            channelId,
            sessionId,
            pc,
            remoteDescSetRef,
            pendingRemoteIceRef,
            flushPendingRemoteIce,
            onSysError: (msg) => {
              setStatus('error');
              setError(msg);
            },
            onConnected: () => setStatus('connected'),
          });
        } catch {
          setStatus('error');
          setError('시그널링 처리 실패');
        }
      },
      [channelId, sessionId, flushPendingRemoteIce]
  );


  const start = useCallback(async () => {
    setStatus('connecting');
    setError('');

    // 초기화
    wsReadyRef.current = false;
    pendingLocalIceRef.current = [];
    remoteDescSetRef.current = false;
    pendingRemoteIceRef.current = [];

    const sig = new SignalingClient({
      onOpen: async () => {
        wsReadyRef.current = true;

        try {
          // ✅ 반드시 첫 메시지: SYS_ATTACH
          sig.sendMessage<SysAttachPayload>(
              'SYS_ATTACH',
              { channelId, sessionId, from: { role: 'HOST' } },
              { resume: false }
          );

          // WS 준비가 끝났으니, 그동안 모인 로컬 ICE flush
          flushPendingLocalIce();

          // PeerConnection 생성
          const pc = new RTCPeerConnection(
              rtcConfig ?? { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
          );
          pcRef.current = pc;

          // 로컬 트랙 추가
          for (const track of stream.getTracks()) {
            pc.addTrack(track, stream);
          }

          // ICE - SIG_ICE
          pc.onicecandidate = (ev) => {
            if (!ev.candidate) return;

            const icePayload: SigIcePayload = {
              candidate: ev.candidate.candidate,
              sdpMid: ev.candidate.sdpMid,
              sdpMLineIndex: ev.candidate.sdpMLineIndex,
            };

            // ✅ WS 준비 전이면 큐잉
            if (!wsReadyRef.current) {
              pendingLocalIceRef.current.push(icePayload);
              return;
            }

            try {
              sig.sendMessage<SigIcePayload>(
                  'SIG_ICE',
                  { channelId, sessionId, from: { role: 'HOST' } },
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
          setError('WS attach / offer 파이프라인 실패');
        }
      },
      onMessage: handleEnvelope,
      onError: () => {
        setStatus('error');
        setError('WebSocket error');
      },
      onClose: () => {
        // 원하시면 여기서 "연결 끊김" UX/상태 반영 가능
      },
    });

    sigRef.current = sig;

    try {
      sig.connect(wsUrl, token);
    } catch {
      setStatus('error');
      setError('WebSocket connect 실패');
    }
  }, [
    wsUrl,
    token,
    channelId,
    sessionId,
    stream,
    rtcConfig,
    handleEnvelope,
    flushPendingLocalIce,
  ]);

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
