import Button from '../../../shared/ui/Button';
import Card from '../../../shared/ui/Card';
import StreamPreview from './StreamPreview';

type Props = {
  title: string;
  remoteStream: MediaStream | null;
  status: string;
  onClickEnd: () => void;
};

export default function HostLivePanel({ title, remoteStream, status, onClickEnd }: Props) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2>Host - 송출 중</h2>

      <Card className="p-3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as any}>
        <div>
          <div style={{ fontWeight: 800 }}>{title}</div>
          <div style={{ color: '#666', marginTop: 4 }}>연결 상태: {status}</div>
        </div>

        <Button variant="secondary" fullWidth={false} onClick={onClickEnd}>
          종료
        </Button>
      </Card>

      {/* 송출 화면도 서버 출력 스트림 */}
      <StreamPreview title="송출 화면(서버 출력)" stream={remoteStream} muted={false} />
    </div>
  );
}
