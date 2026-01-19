import React, { useEffect, useRef, useState } from 'react';

import StreamPreview from '../../screenShare/ui/StreamPreview';
import AudioControl from './AudioControl';
import ReconnectBanner from './ReconnectBanner';
import type { ConnectionStatus } from '../model/useConnectionStatus';
import type { RoomPhase } from '../../screenShare/api/roomStatus';

type Props = {
  status: ConnectionStatus;
  stream: MediaStream | null;
  title?: string;
  muted?: boolean;
  onRetry?: () => void;
  phase?: RoomPhase;

  // 부모(ViewerPage)에서 videoRef를 내려줄 수 있게
  // ViewerPage가 useRef<HTMLVideoElement | null>(null) 이면 아래처럼 null 포함이 안정적
  mediaRef?: React.RefObject<HTMLVideoElement | null>;
};

export default function ViewerMediaPanel({
  status,
  stream,
  title = '시청 화면(서버 출력)',
  muted = false,
  onRetry,
  mediaRef,
}: Props) {
  // 내부 ref (부모가 안 주면 이거 사용)
  const innerRef = useRef<HTMLVideoElement | null>(null);

  // 실제로 사용할 ref는 부모 ref 우선
  const videoRef = mediaRef ?? innerRef;

  // autoplay 실패 시 유저 제스처 필요
  const [needUserGesture, setNeedUserGesture] = useState(false);
  const [playMsg, setPlayMsg] = useState('');

  // stream이 들어오면 autoplay 시도
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // stream이 없으면 오버레이 제거
    if (!stream) {
      setNeedUserGesture(false);
      setPlayMsg('');
      return;
    }

    // StreamPreview가 srcObject 세팅을 하고 있을 가능성이 높지만,
    // autoplay는 여기서 안전하게 한 번 더 시도
    const tryPlay = async () => {
      try {
        await v.play();
        setNeedUserGesture(false);
        setPlayMsg('');
      } catch {
        setNeedUserGesture(true);
        setPlayMsg('자동 재생이 차단되었어요. 재생 버튼을 눌러주세요.');
      }
    };

    void tryPlay();
  }, [stream, videoRef]);

  const handleClickPlay = async () => {
    const v = videoRef.current;
    if (!v) return;

    try {
      await v.play();
      setNeedUserGesture(false);
      setPlayMsg('');
    } catch {
      setNeedUserGesture(true);
      setPlayMsg('재생이 실패했어요. 브라우저 자동재생 설정을 확인해주세요.');
    }
  };

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <ReconnectBanner status={status} onRetry={onRetry} />

      {/* video를 실제로 렌더링하는 컴포넌트 */}
      <div style={{ position: 'relative' }}>
        <StreamPreview ref={videoRef} title={title} stream={stream} muted={muted} />

        {/* autoplay fallback 오버레이 */}
        {needUserGesture && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              gap: 12,
              background: 'rgba(0,0,0,0.55)',
              color: '#fff',
              padding: 16,
              textAlign: 'center',
            }}
          >
            <div>{playMsg}</div>
            <button
              onClick={handleClickPlay}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.5)',
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              재생하기
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {/* 같은 videoRef를 AudioControl에도 전달 */}
        <AudioControl mediaRef={videoRef} />
      </div>
    </div>
  );
}
