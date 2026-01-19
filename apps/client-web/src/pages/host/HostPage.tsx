import { useState } from 'react';

import Card from '../../shared/ui/Card';
import Input from '../../shared/ui/Input';
import Button from '../../shared/ui/Button';
import HostMediaPanel from '../../features/media/ui/HostMediaPanel';


import { useScreenShare } from '../../features/screenShare/model/useScreenShare';

import './HostPage.css';

type Step = 'setup' | 'live';

export default function HostPage() {
  const [step, setStep] = useState<Step>('setup');
  const [title, setTitle] = useState('');

  const { remoteStream, status, error, startCapture, connect, stopAll } = useScreenShare();

  const canGoLive = title.trim().length > 0 && status === 'connected';

  if (step === 'setup') {
    return (
      <div className="hostPage">
        <div className="hostPage__content">
          <h2 className="hostPage__title">Host - 시작</h2>

          <Card className="p-3">
            <Input
              label="방송 제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="방송 제목을 입력하세요"
            />

            <div className="hostPage__actions">
              <Button
                variant="secondary"
                fullWidth={false}
                onClick={async () => {
                  console.log('CLICK startCapture');
                  await startCapture();
                }}
              >
                화면 공유 시작
              </Button>

              <Button fullWidth={false} onClick={() => void connect({ role: 'host' })}>
                서버 연결(변조 미리보기)
              </Button>

              <Button fullWidth={false} disabled={!canGoLive} onClick={() => setStep('live')}>
                송출 화면으로
              </Button>
            </div>

            <div className="hostPage__status">상태: {status}</div>
            {error && <div className="hostPage__error">{error}</div>}
          </Card>

          <HostMediaPanel
              stream={remoteStream}
              title="서버 출력 미리보기"
              muted={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="hostPage">
      <div className="hostPage__content">
        <h2 className="hostPage__title">Host - 송출 중</h2>

        <Card className="p-3 hostPage__liveHeader">
          <div>
            <div className="hostPage__liveTitle">{title}</div>
            <div className="hostPage__liveSub">연결 상태: {status}</div>
          </div>

          <div className="hostPage__liveActions">
            <Button variant="secondary" fullWidth={false} onClick={() => setStep('setup')}>
              설정으로
            </Button>
            <Button
              fullWidth={false}
              onClick={() => {
                stopAll();
                setStep('setup');
              }}
            >
              종료
            </Button>
          </div>
        </Card>

        <HostMediaPanel
            stream={remoteStream}
            title="송출 화면(서버 출력)"
            muted={false}
        />

      </div>
    </div>
  );
}
