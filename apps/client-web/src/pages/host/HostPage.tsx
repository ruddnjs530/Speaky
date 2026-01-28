
import { useState } from 'react';

import Card from '../../shared/ui/Card';
import Input from '../../shared/ui/Input';
import Button from '../../shared/ui/Button';
import HostMediaPanel from '../../features/media/ui/HostMediaPanel';

import { useScreenShare } from '../../features/screenShare/model/useScreenShare';
// [추가] API 및 인증 유틸 Import
import { getAccessToken } from '../../shared/lib/authToken';
import { sessionApi } from '../../features/session/api/sessionApi';

import './HostPage.css';

type Step = 'setup' | 'live';

export default function HostPage() {
  const [step, setStep] = useState<Step>('setup');
  const [title, setTitle] = useState('');

  // [추가] 세션 ID 관리
  const [sessionId, setSessionId] = useState('');

  const { remoteStream, status, error, startCapture, connect, stopAll } = useScreenShare();

  // 송출 가능 조건: 타이틀 O, 연결 O, 세션 생성됨
  const canGoLive = title.trim().length > 0 && status === 'connected' && sessionId !== '';

  // [핸들러 1] "서버 연결" 버튼 핸들러
  const handleConnect = async () => {
    try {
      // 1. 세션 생성 (REST) -> 대기방
      const session = await sessionApi.createSession(title);
      console.log('Session Created: ', session);
      setSessionId(session.sessionId);

      // 2. 토큰 확인
      const token = getAccessToken();
      if (!token) {
        alert('로그인 후 이용해주세요');
        return;
      }

      // 3. WS 연결 (Signaling)
      // connect 호출 시 필요한 정보 전달
      await connect({
        role: 'host',
        // ⚠️ 주의: 백엔드가 wsUrl을 주지 않으므로 로컬 테스트용 URL 사용 (배포 시 수정 필요)
        wsUrl: 'ws://localhost:8080/ws',
        token: token,
        // 임시 채널 ID: "host-{userId}" 형식 사용
        channelId: `host-${session.hostUserId}`,
        sessionId: session.sessionId
      });
    } catch (e) {
      console.error(e);
      alert('세션 생성/연결 실패');
    }
  };

  // [핸들러 2] "송출 화면으로" 버튼 핸들러
  const handleGoLive = async () => {
    if (!sessionId) return;
    try {
      // 4. 방송 시작 (REST) -> LIVE 전환
      await sessionApi.startLive(sessionId);
      setStep('live');
    } catch (e) {
      console.error(e);
      alert('방송 시작 실패');
    }
  };

  // [핸들러 3] "종료" 버튼 핸들러
  const handleStop = async () => {
    if (sessionId) {
      try {
        // 5. 방송 종료 (REST)
        await sessionApi.endBroadcast(sessionId);
      } catch (e) { console.warn(e); }
    }
    stopAll(); // WS 연결 해제
    setStep('setup');
    setSessionId('');
  };

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

              {/*  만든 handleConnect 연결 */}
              <Button fullWidth={false} onClick={handleConnect}>
                서버 연결(변조 미리보기)
              </Button>

              {/* 만든 handleGoLive 연결 */}
              <Button fullWidth={false} disabled={!canGoLive} onClick={handleGoLive}>
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
            {/* 설정으로 버튼에도 종료 로직 연결 */}
            <Button variant="secondary" fullWidth={false} onClick={handleStop}>
              설정으로
            </Button>

            {/* 만든 handleStop 연결 */}
            <Button
              fullWidth={false}
              onClick={handleStop}
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