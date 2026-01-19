import { useCallback, useRef, useState } from 'react';
import { sendOfferToServer } from '../api/signaling';

type Role = 'host' | 'viewer';
type Status = 'idle' | 'captured' | 'connecting' | 'connected' | 'error';

type ConnectArgs = {
  role: Role;
  stream?: MediaStream;   // host는 캡처한 stream을 직접 넘길 수 있게
  roomId?: string;        // 나중에 viewer 구독에 필요하면 사용
};

export function useScreenShare() {
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

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
      vt.onended = () => {
        s.getTracks().forEach((t) => t.stop());
        setLocalStream(null);
        setRemoteStream(null);
        pcRef.current?.close();
        pcRef.current = null;
        setStatus('idle');
      };

      return s;
    } catch (e) {
      console.error('getDisplayMedia failed:', e);
      const err = e as DOMException;
      setError(`${err.name}: ${err.message}`);
      setStatus('error');
      return null;
    }
  }, []);

  const connect = useCallback(async ({ role, stream, roomId }: ConnectArgs) => {
    setError('');
    setStatus('connecting');

    const outbound = role === 'host' ? (stream ?? localStream) : null;
    if (role === 'host' && !outbound) {
      setError('호스트는 먼저 화면 공유를 시작해야 해요.');
      setStatus('error');
      return;
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pcRef.current = pc;

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

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const answer = await sendOfferToServer(offer, { role, roomId });
      await pc.setRemoteDescription(answer);

      setStatus('connected');
    } catch {
      setError('서버 연결에 실패했어요.');
      setStatus('error');
      pc.close();
      pcRef.current = null;
      setRemoteStream(null);
    }
  }, [localStream]);

  const stopAll = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;

    localStream?.getTracks().forEach((t) => t.stop());

    setLocalStream(null);
    setRemoteStream(null);
    setStatus('idle');
    setError('');
  }, [localStream]);

  return { localStream, remoteStream, status, error, startCapture, connect, stopAll };
}
