import { useState, useEffect } from 'react';

import Card from '../../shared/ui/Card';
import Input from '../../shared/ui/Input';
import Button from '../../shared/ui/Button';
import HostMediaPanel from '../../features/media/ui/HostMediaPanel';

import { useScreenShare } from '../../features/screenShare/model/useScreenShare';

import { getAccessToken } from '../../shared/lib/authToken';
import { sessionApi } from '../../features/session/api/sessionApi';

// import './HostPage.css'; // Removed
import HealthBadgesPanel from '../../features/host/ui/HealthBadgesPanel';
import { usePrecheckModel } from '../../features/host/hooks/usePrecheckModel';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import Modal from '../../shared/ui/Modal';
import { getErrorMessage } from '../../shared/lib/errorUtils';

import { WS_URL_DEFAULT } from '../../shared/config';
// import { Home } from 'lucide-react';

type Step = 'setup' | 'live';

const WS_URL = WS_URL_DEFAULT;

export default function HostPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const precheckedVoiceId = (location.state as { voiceId?: string | number })?.voiceId;
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

  // 마이크 권한 거부 시 안내 메시지 표시
  useEffect(() => {
    if (mic.permission === 'denied') {
      console.warn('마이크 권한이 거부되었습니다.');
    }
  }, [mic.permission]);

  const { remoteStream, status, error, startCapture, connect, stopAll } = useScreenShare();

  // 송출 가능 조건: 타이틀 O, 연결 O, 세션 생성됨
  const canGoLive = title.trim().length > 0 && status === 'connected' && sessionId !== '';

  // [핸들러 1] "서버 연결" 버튼 핸들러
  const handleConnect = async () => {
    try {
      const session = await sessionApi.createSession(title, voiceModelId);
      console.log('Session Created: ', session);
      setSessionId(session.sessionId);

      const userToken = getAccessToken();
      const finalToken = session.signalingToken || userToken;
      const finalWsUrl = session.wsUrl || WS_URL;
      if (!finalToken) {
        alert('로그인 후 이용해주세요 (또는 서버 토큰 발급 실패)');
        return;
      }

      await connect({
        role: 'host',
        wsUrl: finalWsUrl,
        token: finalToken,
        channelId: session.channelId || `host-${session.hostUserId}`,
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
        await sessionApi.endBroadcast(sessionId);
      } catch (e) {
        const msg = getErrorMessage(e) || '알 수 없는 오류';
        console.error(`방송 종료 실패: ${msg}`, e);
      }
    }
    stopAll();
    setShowEndModal(true);
    setSessionId('');
  };

  const confirmEnd = () => {
    setShowEndModal(false);
    navigate('/', { replace: true });
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-orange-50 to-amber-50 flex flex-col font-sans overflow-hidden">
      {/* 헤더 */}
      <header className="flex-none px-6 py-4 flex items-center justify-between border-b border-white/50 bg-white/30 backdrop-blur-sm z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-sm font-medium">
            <Link
              to="/"
              className="px-3 py-2 rounded-lg text-gray-600 hover:bg-orange-100 hover:text-orange-600 transition-colors"
            >
              홈으로
            </Link>
            <Link
              to="/host/precheck"
              className="px-3 py-2 rounded-lg text-gray-600 hover:bg-orange-100 hover:text-orange-600 transition-colors"
            >
              사전 점검
            </Link>
          </div>
          <div className="h-4 w-px bg-gray-300 mx-2" />
          <h1 className="text-xl font-bold text-gray-800">
            {step === 'setup' ? 'Host - 방송 설정' : 'Host - On Air'}
          </h1>
        </div>

        {/* Live 모드일 때 상단에 상태 배지 표시 */}
        {step === 'live' && (
          <HealthBadgesPanel viewers="집계 중" health={health} />
        )}
      </header>

      {/* 메인 컨텐츠 영역 */}
      <main className="flex-1 p-6 overflow-hidden flex flex-col min-h-0 container mx-auto max-w-7xl">
        {step === 'setup' ? (
          // Setup Mode Layout
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-0">
            {/* 좌측: 미리보기 (Main) */}
            <div className="lg:col-span-7 h-full min-h-0 flex flex-col order-first">
              <div className="flex-1 bg-black rounded-xl overflow-hidden shadow-lg border border-gray-900/10 min-h-0">
                <HostMediaPanel
                  stream={remoteStream}
                  title="서버 출력 미리보기"
                  muted={false}
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="mt-2 text-center text-sm text-gray-500">
                실제 시청자가 보게 될 변조된 화면/음성입니다.
              </p>
            </div>

            {/* 우측: 설정 (Side) */}
            <div className="lg:col-span-5 flex flex-col gap-6 h-full min-h-0 overflow-y-auto pr-2 custom-scrollbar">
              <Card title="① 방송 정보 입력" className="flex-none">
                <div className="flex flex-col gap-4">
                  <Input
                    label="방송 제목"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="방송 제목을 입력하세요"
                  />
                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    선택된 AI 보이스: <strong className="text-orange-600">AI 보이스 {voiceModelId}</strong>
                  </div>
                </div>
              </Card>

              <Card title="② 연결 및 제어" className="flex-none">
                <div className="flex flex-col gap-3">
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      console.log('CLICK startCapture');
                      await startCapture();
                    }}
                  >
                    1. 화면 공유 시작
                  </Button>

                  <Button onClick={handleConnect}>
                    2. 서버 연결 (변조 미리보기)
                  </Button>

                  <div className="h-px bg-gray-100 my-2" />

                  <div className="flex flex-col gap-2">
                    <Button disabled={!canGoLive} onClick={handleGoLive} className="bg-orange-600 hover:bg-orange-700 text-white">
                      3. 방송 시작 (ON AIR)
                    </Button>
                    {!canGoLive && (
                      <p className="text-xs text-center text-gray-400">
                        * 화면 공유 및 서버 연결 후 시작 가능
                      </p>
                    )}
                  </div>
                </div>

                {/* 상태/에러 메시지 */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">연결 상태</span>
                    <span className={`font-semibold ${status === 'connected' ? 'text-green-600' : 'text-gray-700'}`}>
                      {status}
                    </span>
                  </div>
                  {error && (
                    <div className="mt-2 text-sm text-red-500 bg-red-50 p-2 rounded">
                      {error}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        ) : (
          // 생방송 레이아웃
          <div className="flex flex-col h-full gap-6">
            {/* 메인 송출 화면 */}
            <div className="flex-1 bg-black rounded-xl overflow-hidden shadow-2xl relative min-h-0 border border-gray-900/10">
              <HostMediaPanel
                stream={remoteStream}
                title={`ON AIR - ${title}`}
                muted={false}
                className="w-full h-full object-contain"
              />

              {/* 화면 위 오버레이 정보 (선택사항) */}
              <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1.5 rounded-full text-sm backdrop-blur-sm border border-white/10 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                ON AIR
              </div>
            </div>

            {/* 하단 제어바 */}
            <Card className="flex-none p-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-col gap-1">
                  <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span>AI 보이스 {voiceModelId}</span>
                    <span className="w-px h-3 bg-gray-300" />
                    <span>{status}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {mic.permission === 'denied' && (
                    <span className="text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 flex items-center gap-1.5">
                      ⚠️ 마이크 권한 없음
                    </span>
                  )}

                  <Button variant="secondary" onClick={handleStop} className="w-auto px-6">
                    설정으로
                  </Button>
                  <Button onClick={handleStop} className="w-auto px-6 bg-red-600 hover:bg-red-700 text-white border-transparent">
                    방송 종료
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>

      <Modal
        open={showEndModal}
        title="방송 종료"
        primaryLabel="홈으로 이동"
        onPrimary={confirmEnd}
      >
        <div className="text-center py-4">
          <p className="text-lg text-gray-800 mb-2">방송이 종료되었습니다.</p>
          <p className="text-gray-500">수고하셨습니다 👏</p>
        </div>
      </Modal>
    </div>
  );
}
