import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import ViewerMediaPanel from '../../features/media/ui/ViewerMediaPanel';
import AudioControl from '../../features/media/ui/AudioControl';
import ReconnectBanner from '../../features/media/ui/ReconnectBanner';

import Card from '../../shared/ui/Card';
import Button from '../../shared/ui/Button';

import { useScreenShare } from '../../features/screenShare/model/useScreenShare';
import { fetchRoomPhase, type RoomPhase } from '../../features/screenShare/api/roomStatus';

export default function ViewerPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const { remoteStream, status, error, connect } = useScreenShare();

  // viewer 화면 분기 상태
  const [phase, setPhase] = useState<RoomPhase>('waiting');

  // 방 상태 폴링 (waiting -> live 감지)
  useEffect(() => {
    if (!roomId) return;

    let alive = true;
    const tick = async () => {
      const p = await fetchRoomPhase(roomId).catch(() => 'error' as RoomPhase);
      if (!alive) return;
      setPhase(p);
    };

    void tick();
    const t = window.setInterval(tick, 2000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [roomId]);

  // live로 바뀌면 자동 connect
  useEffect(() => {
    if (!roomId) return;
    if (phase !== 'live') return;
    if (status === 'connected' || status === 'connecting') return;

    void connect({ role: 'viewer', roomId });
  }, [phase, roomId, status, connect]);

  // 수동 시작 버튼도 남겨두기
  const handleStart = () => {
    if (!roomId) return;
    void connect({ role: 'viewer', roomId });
  };

  return (
    <div style={{ padding: 24, display: 'grid', gap: 12 }}>
      <h1>Viewer</h1>

      <ReconnectBanner status={status as any} onRetry={() => window.location.reload()} />

      <Card className="p-3">
        <p>roomId: {roomId}</p>
        <p>방 상태: {phase}</p>
        <p>연결 상태: {status}</p>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}

        {/* waiting일 때는 버튼 보여주고, live면 자동으로 붙도록 */}
        {phase === 'waiting' && (
          <p style={{ marginTop: 8 }}>호스트가 아직 방송을 시작하지 않았어요. 시작되면 자동으로 연결할게요.</p>
        )}

        <Button onClick={handleStart} disabled={!roomId || status === 'connecting'}>
          시청 시작(수동)
        </Button>
      </Card>

      <div className="viewer-media">
        {/* autoplay 처리는 ViewerMediaPanel 안에서 */}
        <ViewerMediaPanel
          status={status}
          stream={remoteStream}
          muted={false}
          mediaRef={videoRef}          // ref 내려주기(패널이 video에 연결)
          phase={phase}               // 패널에서 waiting/ended 문구도 가능
          onRetry={() => window.location.reload()}
        />

        <AudioControl mediaRef={videoRef} />
      </div>
    </div>
  );
}
