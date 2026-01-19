import Button from '../../../shared/ui/Button';
import Card from '../../../shared/ui/Card';
import Input from '../../../shared/ui/Input';
import StreamPreview from './StreamPreview';

type Props = {
  title: string;
  onChangeTitle: (v: string) => void;

  remoteStream: MediaStream | null;
  status: string;
  error: string;

  onClickCapture: () => void;
  onClickConnect: () => void;
  onClickGoLive: () => void;
};

export default function HostStartPanel({
  title,
  onChangeTitle,
  remoteStream,
  status,
  error,
  onClickCapture,
  onClickConnect,
  onClickGoLive,
}: Props) {
  const canGoLive = title.trim().length > 0 && status === 'connected';

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2>Host - 시작</h2>

      <Card className="p-3">
        <Input
          label="방송 제목"
          value={title}
          onChange={(e) => onChangeTitle(e.target.value)}
          placeholder="방송 제목을 입력하세요"
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Button variant="secondary" fullWidth={false} onClick={onClickCapture}>
            화면 공유 선택
          </Button>

          <Button fullWidth={false} onClick={onClickConnect}>
            서버 연결(변조 미리보기)
          </Button>

          <Button fullWidth={false} disabled={!canGoLive} onClick={onClickGoLive}>
            송출 화면으로
          </Button>
        </div>

        <div style={{ marginTop: 8, color: '#666' }}>상태: {status}</div>
        {error && <div style={{ marginTop: 8, color: 'crimson' }}>{error}</div>}
      </Card>

      {/* 미리보기는 서버에서 돌아온 remoteStream */}
      <StreamPreview title="서버 출력 미리보기" stream={remoteStream} muted={false} />
    </div>
  );
}
