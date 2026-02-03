
import { useState, useEffect, useRef } from 'react';

import Card from '../../shared/ui/Card';
import Input from '../../shared/ui/Input';
import Button from '../../shared/ui/Button';
import HostMediaPanel from '../../features/media/ui/HostMediaPanel';

import { useScreenShare } from '../../features/screenShare/model/useScreenShare';

import { getAccessToken } from '../../shared/lib/authToken';
import { sessionApi } from '../../features/session/api/sessionApi';

import './HostPage.css';
import HealthBadgesPanel from '../../features/host/ui/HealthBadgesPanel';
import { usePrecheckModel } from '../../features/host/hooks/usePrecheckModel';
import { useNavigate, useLocation, useBlocker } from 'react-router-dom';
import Modal from '../../shared/ui/Modal';
import { getErrorMessage } from '../../shared/lib/errorUtils';

type Step = 'setup' | 'live';

import { WS_URL_DEFAULT } from '../../shared/config';

const WS_URL = WS_URL_DEFAULT;

export default function HostPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const precheckedVoiceId = (location.state as { voiceId?: string })?.voiceId;
  const [step, setStep] = useState<Step>('setup');
  const [title, setTitle] = useState('');
  // 종료 모달
  const [showEndModal, setShowEndModal] = useState(false);

  // 세션 ID 관리
  const [sessionId, setSessionId] = useState('');

  // 헬스 체크 모델 (마이크 모니터링용)
  const { health, actions, mic } = usePrecheckModel();

  // 초기 voiceModelId 설정
  const [voiceModelId, setVoiceModelId] = useState<number | null>(() => {
    if (precheckedVoiceId !== undefined && precheckedVoiceId !== null) {
      if (typeof precheckedVoiceId === 'number') return precheckedVoiceId;
      return parseInt(String(precheckedVoiceId).replace(/[^0-9]/g, ""), 10) || 1;
    }
    return 1;
  });

  // Live 상태 진입 시 마이크 모니터링 시작
  useEffect(() => {
    if (step === 'live') {
      if (mic.permission === 'idle') {
        actions.requestMicPermission();
      } else if (mic.permission === 'granted') {
        actions.startLevelMonitor();
      }
    }
  }, [step, mic.permission, actions]);

  // 마이크 권한 거부 시 안내 메시지 표시 (간단한 예시)
  // 실제 프로덕션에서는 더 예쁜 모달이나 토스트 메시지를 사용하는 것이 좋음
  useEffect(() => {
    if (mic.permission === 'denied') {
      // alert보다는 화면에 직접 표시하거나 커스텀 UI를 쓰는 것이 좋지만,
      // 현재는 빠른 피드백 반영을 위해 간단한 안내 문구를 렌더링하는 방식으로 접근
      console.warn('마이크 권한이 거부되었습니다.');
    }
  }, [mic.permission]);

  const { remoteStream, status, error, startCapture, connect, stopAll } = useScreenShare();


  // stopAll이 재생성되어도 effect가 다시 실행되지 않도록 ref 사용
  const stopAllRef = useRef(stopAll);
  useEffect(() => {
    stopAllRef.current = stopAll;
  }, [stopAll]);

  // 컴포넌트 언마운트 시에만 정리 로직 실행
  useEffect(() => {
    return () => {
      stopAllRef.current();
    };
  }, []);

  // 송출 가능 조건: 타이틀 O, 연결 O, 세션 생성됨
  const canGoLive = title.trim().length > 0 && status === 'connected' && sessionId !== '';

  // 이탈 방지 블로커
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      sessionId !== '' && currentLocation.pathname !== nextLocation.pathname
  );

  // 블로커가 'blocked' 상태일 때 모달 표시
  const showBlockerModal = blocker.state === 'blocked';

  // [핸들러 1] "서버 연결" 버튼 핸들러
  const handleConnect = async () => {
    try {
      // 1. 세션 생성 (REST) -> 대기방
      // voiceModelId는 state에서 가져옴 (초기화됨)
      const session = await sessionApi.createSession(title, voiceModelId);
      console.log('Session Created: ', session);
      setSessionId(session.sessionId);

      // 2. 토큰 및 URL 결정
      // 백엔드가 준 signalingToken이 있으면 최우선 사용, 없으면 내 로그인 토큰(fallback)
      const userToken = getAccessToken();
      const finalToken = session.signalingToken || userToken;
      const finalWsUrl = session.wsUrl || WS_URL; // WS_URL은 상단에 정의된 fallback
      if (!finalToken) {
        alert('로그인 후 이용해주세요 (또는 서버 토큰 발급 실패)');
        return;
      }

      // 3. WS 연결 (Signaling)
      await connect({
        role: 'host',
        wsUrl: finalWsUrl,
        token: finalToken,
        channelId: session.channelId || `host-${session.hostUserId}`, // 서버가 준 channelId 우선
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
      } catch (e) {
        // 헬퍼 함수를 사용해 에러 메시지 추출
        const msg = getErrorMessage(e) || '알 수 없는 오류';
        console.error(`방송 종료 실패: ${msg}`, e);
      }
    }
    stopAll(); // WS 연결 해제
    setShowEndModal(true);
    setSessionId('');
  };

  // 종료 모달 확인 핸들러
  const confirmEnd = () => {
    setShowEndModal(false);
    navigate('/', { replace: true }); // 홈으로 이동
  };

  // 렌더링 컨텐츠 결정
  const renderContent = () => {
    if (step === 'setup') {
      return (
        <div className="hostPage__content">
          <h2 className="hostPage__title">Host - 시작</h2>

          <Card className="p-3">
            <Input
              label="방송 제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="방송 제목을 입력하세요"
            />
            <div style={{ marginTop: '10px', fontSize: '14px', color: '#555' }}>
              선택된 AI 보이스: <strong>AI 보이스 {voiceModelId}</strong>
            </div>

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
      );
    }

    // Live Step
    return (
      <div className="hostPage__content">
        <h2 className="hostPage__title">Host - 송출 중</h2>

        <Card className="p-3 hostPage__liveHeader">
          <div>
            <div className="hostPage__liveTitle">{title}</div>
            <div className="hostPage__liveSub">연결 상태: {status}</div>
            <div className="hostPage__liveSub">AI 보이스: {voiceModelId ? `AI 보이스 ${voiceModelId}` : '없음'}</div>
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

        <div style={{ marginTop: '1rem' }}>
          {mic.permission === 'denied' && (
            <div style={{ padding: '8px', backgroundColor: '#xffebee', color: '#b91c1c', borderRadius: '4px', marginBottom: '8px', fontSize: '14px' }}>
              🎤 마이크 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용하고 새로고침 해주세요.
            </div>
          )}
          <HealthBadgesPanel
            viewers="집계 중"
            health={health}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="hostPage">
      {renderContent()}

      <Modal
        open={showEndModal}
        title="방송 종료"
        primaryLabel="홈으로 이동"
        onPrimary={confirmEnd}
      >
        <p>방송이 종료되었습니다.</p>
        <p>수고하셨습니다 👏</p>
      </Modal>

      {/* 이탈 방지 모달 */}
      <Modal
        open={showBlockerModal}
        title="방송 종료 확인"
        primaryLabel="종료하고 나가기"
        secondaryLabel="계속 방송하기"
        onPrimary={() => {
          // 진행 (이동 허용) -> useEffect cleanup에서 stopAll 호출됨
          if (blocker.state === 'blocked') {
            blocker.proceed();
          }
        }}
        onSecondary={() => {
          // 취소 (현재 페이지 유지)
          if (blocker.state === 'blocked') {
            blocker.reset();
          }
        }}
      >
        <p>방송 중입니다.</p>
        <p>페이지를 벗어나면 방송이 종료됩니다.</p>
        <p style={{ color: '#ef4444', marginTop: '0.5rem' }}>정말 나가시겠습니까?</p>
      </Modal>
    </div>
  );
}