import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Volume2, VolumeX, Users, RefreshCcw, LogOut, Maximize, Minimize } from 'lucide-react';
import ViewerMediaPanel from '../../features/media/ui/ViewerMediaPanel';
import AudioControl from '../../features/media/ui/AudioControl';
import Card from '../../shared/ui/Card';
import Button from '../../shared/ui/Button';
import { useScreenShare } from '../../features/screenShare/model/useScreenShare';
import { sessionApi } from '../../features/session/api/sessionApi';
import { getErrorCode, getErrorMessage } from '../../shared/lib/errorUtils';
import { SignalingClient } from '../../shared/lib/signaling/SignalingClient';
import { getAccessToken } from '../../shared/lib/authToken';
import { useAuthRedirect } from '../../features/auth/lib/useAuthRedirect';
import { WS_URL_DEFAULT } from '../../shared/config';
import { motion, AnimatePresence } from 'framer-motion';

import './ViewerPage.css';

type JoinUiState =
  | { kind: 'idle' }
  | { kind: 'joining' }
  | { kind: 'joined' }
  | { kind: 'notActive' }
  | { kind: 'unauthorized' }
  | { kind: 'error'; message: string };
type JoinAction =
  | { type: 'JOIN_START' }
  | { type: 'JOINED' }
  | { type: 'NOT_ACTIVE' }
  | { type: 'UNAUTHORIZED' }
  | { type: 'ERROR'; message: string };

function joinReducer(_state: JoinUiState, action: JoinAction): JoinUiState {
  switch (action.type) {
    case 'JOIN_START':
      return { kind: 'joining' };
    case 'JOINED':
      return { kind: 'joined' };
    case 'NOT_ACTIVE':
      return { kind: 'notActive' };
    case 'UNAUTHORIZED':
      return { kind: 'unauthorized' };
    case 'ERROR':
      return { kind: 'error', message: action.message };
    default:
      return { kind: 'idle' };
  }
}

export default function ViewerPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  // const location = useLocation(); // 인증 리팩토링 후 미사용
  const channelId = roomId ?? '';
  const { remoteStream, status, connect } = useScreenShare();

  useAuthRedirect();

  // 초기 mount에서 joining 상태로 시작 (effect에서 동기 setState를 피하기 위함)
  const [joinUi, dispatch] = useReducer(
    joinReducer,
    channelId ? ({ kind: 'joining' } as JoinUiState) : ({ kind: 'idle' } as JoinUiState)
  );

  // effect 트리거용 attempt 카운터
  const [attempt, setAttempt] = useState(() => (channelId ? 1 : 0));
  const [voiceModelId, setVoiceModelId] = useState<number | null>(null);
  const [title, setTitle] = useState<string>('');
  /**
   * 재시도(=reconnect): UI 상태 전환 + attempt 증가
   * - 여기서 상태를 바꾸므로, effect에서는 동기 setState를 하지 않습니다.
   */
  const startJoin = useCallback(() => {
    if (!channelId) return;
    dispatch({ type: 'JOIN_START' });
    setAttempt((a) => a + 1);
  }, [channelId]);
  /**
   * 네트워크 호출은 effect에서 수행하되,
   * effect 시작 시점에는 setState/dispatch를 동기로 호출하지 않습니다.
   */


  // 대기 모드용 WS 클라이언트 참조
  const waitingScRef = useRef<SignalingClient | null>(null);

  useEffect(() => {
    if (!channelId) return;

    let isActive = true; // 언마운트 체크용

    // 개선: 이 effect 실행 주기에서 만든 소켓을 추적
    let mySc: SignalingClient | null = null;
    const tryJoin = async () => {
      try {
        const res = await sessionApi.joinLive(channelId);
        if (!isActive) return;
        // 성공 시: 대기하던 소켓이 있다면 닫기
        if (waitingScRef.current) {
          waitingScRef.current.close();
          waitingScRef.current = null;
        }

        dispatch({ type: 'JOINED' });

        await connect({
          role: 'viewer',
          wsUrl: res.wsUrl,
          token: res.token,
          channelId: res.channelId,
          sessionId: res.sessionId,
        });
        setVoiceModelId(res.voiceModelId);
        setTitle(res.title);

      } catch (e: any) {
        if (!isActive) return;

        const code = getErrorCode(e);
        const msg = getErrorMessage(e) ?? '시청 연결 실패';

        // [수정] 연결 실패/종료 시 무조건 대기 모드(NOT_ACTIVE)로 전환하여 재연결 시도
        // 기존에는 SESSION_NOT_ACTIVE만 대기했지만, 이제는 WS 연결 끊김 등도 대기로 처리
        console.warn(`[AutoRetry] Connection failed/lost (${code}). Entering waiting mode.`);
        dispatch({ type: 'NOT_ACTIVE' });

        // 이미 대기 중 WS가 연결돼 있다면 패스
        if (waitingScRef.current) return;

        console.log('[AutoRouting] 방송 대기 모드: WS 연결 시작');

        const wsUrl = WS_URL_DEFAULT;

        const token = getAccessToken() ?? '';
        const sc = new SignalingClient({
          channelId,
          sessionId: 'waiting',
          role: 'GUEST',
          clientId: 'waiting-' + Math.random().toString(36).slice(2)
        }, {
          onOpen: () => console.log('[AutoRouting] WS Connected (Waiting)'),
          onInbound: (msg) => {
            if (msg.type === 'SYS_SESSION_STARTED' || msg.type === 'SESSION_LIVE_STARTED') {
              console.log('[AutoRouting] 방송 시작 감지! -> Retrying join');
              // 여기서 닫지 않고, 재시도(attempt++) 시 cleanup 혹은 tryJoin 진입 시점에 처리
              setAttempt(prev => prev + 1);
            }
          }
        });
        sc.connect(wsUrl, token);

        waitingScRef.current = sc;
        mySc = sc; // 내가 만든 소켓임 표시
      }
    };

    tryJoin();

    return () => {
      isActive = false;
      if (mySc) {
        mySc.close();
        if (waitingScRef.current === mySc) {
          waitingScRef.current = null;
        }
      }
    };
  }, [channelId, attempt, connect]);
  const reload = useCallback(() => window.location.reload(), []);
  // ---- 오디오 제어 로직 ----
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);

  // 전체 화면 로직
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen();
      } catch (err) {
        console.error('전체 화면 전환 실패:', err);
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    }
  };

  // ---- 레이아웃 렌더링 ----
  if (!channelId) {
    return (
      <div className="viewerPage__container">
        <Card className="viewerPage__card">
          <h2 className="viewerPage__title" style={{ marginBottom: '0.5rem' }}>잘못된 접근</h2>
          <p style={{ color: '#9ca3af' }}>channelId(roomId)가 없습니다.</p>
        </Card>
      </div>
    );
  }

  // 로그인 필요 분기
  if (joinUi.kind === 'unauthorized') {
    return (
      <div className="viewerPage__container">
        <Card className="viewerPage__card">
          <h2 className="viewerPage__title" style={{ marginBottom: '1rem' }}>로그인이 필요합니다</h2>
          <Button onClick={() => (window.location.href = '/login')} variant="primary">
            로그인 하러 가기
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <motion.div
      className="viewerPage"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >

      {/* 1. 상단 정보 바 */}
      <motion.div
        className="viewerPage__topBar"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="viewerPage__titleGroup">
          <h1 className="viewerPage__title">
            {title || `${channelId}의 방송`}
          </h1>
          {joinUi.kind === 'joined' ? (
            <motion.span
              className="viewerPage__badge viewerPage__badge--live"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
            >
              <motion.span
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="mr-1 inline-block h-2 w-2 rounded-full bg-white"
              />
              LIVE
            </motion.span>
          ) : (
            <span className="viewerPage__badge viewerPage__badge--offline">
              OFFLINE
            </span>
          )}
        </div>
        <div className="viewerPage__infoRow">
          <span className="viewerPage__infoLabel">Voice:</span>
          <span>{voiceModelId ? `AI 보이스 ${voiceModelId}` : '정보 없음'}</span>
        </div>

        {/* 지연 시간 (더미 데이터) */}
        <div className="viewerPage__latency">
          지연 시간: <span className="viewerPage__latencyValue">25ms</span>
        </div>
      </motion.div>

      {/* 2. 메인 비디오 영역 */}
      <motion.div
        className="viewerPage__videoArea"
        ref={containerRef}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <ViewerMediaPanel
          status={status}
          stream={remoteStream}
          muted={false} // AudioControl에서 직접 제어하므로 여기선 기본값 처리
          onVideoElement={setVideoEl} // 제어권을 위해 element 확보
          showAudioControl={false} // 하단 바에서 제어하므로 숨김
          onRetry={startJoin}
          onReload={reload}
        />

        {/* 오버레이: 방송 대기 중 */}
        {joinUi.kind === 'notActive' && (
          <div className="viewerPage__overlay viewerPage__overlay--wait">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="viewerPage__overlayTitle">대기 화면입니다</h2>
              <p className="viewerPage__overlayText">호스트가 송출을 시작하면 자동으로 갱신 됩니다.</p>
            </motion.div>
          </div>
        )}

        {/* 오버레이: 오류 발생 */}
        {joinUi.kind === 'error' && (
          <div className="viewerPage__overlay viewerPage__overlay--error">
            <h2 className="viewerPage__overlayTitle" style={{ color: '#ef4444' }}>오류 발생</h2>
            <p className="viewerPage__overlayText" style={{ marginBottom: '1.5rem' }}>{joinUi.message}</p>
            <div className="viewerPage__overlayActions">
              <Button onClick={startJoin} variant="secondary">재시도</Button>
              <Button onClick={reload} variant="secondary">새로고침</Button>
            </div>
          </div>
        )}

        {/* 전체 화면 버튼 */}
        <button
          onClick={toggleFullscreen}
          className="viewerPage__fsOverlayBtn"
          title="전체 화면"
        >
          {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
        </button>
      </motion.div>

      {/* 3. 하단 컨트롤 바 */}
      <motion.div
        className="viewerPage__controlBar"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >

        {/* 좌측하단 볼륨 */}
        <div className="viewerPage__controlSection viewerPage__controlSection--left">
          <AudioControl mediaEl={videoEl} className="text-gray-200" />
        </div>

        {/* 중앙: 입장 인원 (더미 데이터) */}
        <div className="viewerPage__controlSection viewerPage__controlSection--center">
          <Users size={20} />
          <span>입장 인원 <span className="viewerPage__countHighlight">1,234</span>명</span>
        </div>

        {/* 우측하단 액션 버튼 */}
        <div className="viewerPage__controlSection viewerPage__controlSection--right">
          <button
            onClick={reload}
            className="viewerPage__btnSync" // 디자인 일치를 위한 커스텀 클래스
          >
            <RefreshCcw size={16} />
            싱크 맞추기
          </button>

          <button
            onClick={() => navigate('/')}
            className="viewerPage__btnExit" // 디자인 일치를 위한 커스텀 클래스
          >
            <LogOut size={16} />
            종료
          </button>
        </div>

      </motion.div>

    </motion.div>
  );
}