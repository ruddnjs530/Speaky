import { useCallback, useEffect, useState } from 'react';

import StreamPreview from '../../screenShare/ui/StreamPreview';
import AudioControl from './AudioControl';
import ReconnectBanner from './ReconnectBanner';
import type { ConnectionStatus } from '../model/useConnectionStatus';

type Props = {
  status: ConnectionStatus;
  stream: MediaStream | null;
  title?: string;
  muted?: boolean;
  onRetry?: () => void;
  onReload?: () => void;
};

function getErrorName(e: unknown): string | undefined {
  if (typeof e === 'object' && e !== null && 'name' in e) {
    const v = (e as { name?: unknown }).name;
    return typeof v === 'string' ? v : undefined;
  }
  return undefined;
}

function isAutoplayBlocked(e: unknown): boolean {
  const name = getErrorName(e);
  return name === 'NotAllowedError' || name === 'NotSupportedError';
}

export default function ViewerMediaPanel({
  status,
  stream,
  title = '시청 화면(서버 출력)',
  muted = false,
  onRetry,
  onReload,
}: Props) {
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [needUserGesture, setNeedUserGesture] = useState(false);
  const [playMsg, setPlayMsg] = useState('');

  const tryPlay = useCallback(async () => {
    if (!videoEl) return;
    if (!stream) return;

    try {
      // eslint-disable-next-line react-hooks/immutability
      videoEl.playsInline = true;
      videoEl.muted = Boolean(muted);

      await videoEl.play();

      queueMicrotask(() => {
        setNeedUserGesture(false);
        setPlayMsg('');
      });
    } catch (e) {
      const msg = isAutoplayBlocked(e)
        ? '브라우저 정책으로 자동 재생이 차단되었습니다. 재생 버튼을 눌러주세요.'
        : '재생에 실패했습니다. 다시 시도해주세요.';

      queueMicrotask(() => {
        setNeedUserGesture(true);
        setPlayMsg(msg);
      });
    }
  }, [videoEl, stream, muted]);

  useEffect(() => {
    if (!videoEl) return;

    if (!stream) {
      queueMicrotask(() => {
        setNeedUserGesture(false);
        setPlayMsg('');
      });
      return;
    }

    if (status !== 'connected') return;

    void tryPlay();

    const onLoaded = () => void tryPlay();
    videoEl.addEventListener('loadedmetadata', onLoaded);
    return () => {
      videoEl.removeEventListener('loadedmetadata', onLoaded);
    };
  }, [videoEl, stream, status, tryPlay]);

  const handleClickPlay = useCallback(async () => {
    // TODO(Day3-B): 클릭 재생 성공 후 muted 해제 정책 결정 필요.
    // if (videoEl) videoEl.muted = false;
    await tryPlay();
  }, [tryPlay]);

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <ReconnectBanner status={status} onRetry={onRetry} onReload={onReload} />


      <div style={{ position: 'relative' }}>
        <StreamPreview ref={setVideoEl} title={title} stream={stream} muted={muted} />

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
        {/* AudioControl을 엘리먼트 직접 받도록 수정 필요 */}
        <AudioControl mediaEl={videoEl} />
      </div>
    </div>
  );
}
