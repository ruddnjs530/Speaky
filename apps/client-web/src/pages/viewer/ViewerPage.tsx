import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ViewerMediaPanel from '../../features/media/ui/ViewerMediaPanel';
import Card from '../../shared/ui/Card';
import Button from '../../shared/ui/Button';
import Modal from '../../shared/ui/Modal';
import { useScreenShare } from '../../features/screenShare/model/useScreenShare';
import { sessionApi } from '../../features/session/api/sessionApi';
import { getErrorCode, getErrorMessage } from '../../shared/lib/errorUtils';
import { SignalingClient } from '../../shared/lib/signaling/SignalingClient';
import { getAccessToken } from '../../shared/lib/authToken';
import { WS_URL_DEFAULT } from '../../shared/config';

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
  const channelId = roomId ?? '';
  const { remoteStream, status, error, connect } = useScreenShare();

  // 초기 mount에서 joining 상태로 시작 (effect에서 동기 setState를 피하기 위함)
  const [joinUi, dispatch] = useReducer(
    joinReducer,
    channelId ? ({ kind: 'joining' } as JoinUiState) : ({ kind: 'idle' } as JoinUiState)
  );

  // effect 트리거용 attempt 카운터
  const [attempt, setAttempt] = useState(() => (channelId ? 1 : 0));
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

    // 🛠 개선: 이 effect 실행 주기에서 만든 소켓을 추적
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

      } catch (e: any) {
        if (!isActive) return;

        const code = getErrorCode(e);
        const msg = getErrorMessage(e) ?? '시청 연결 실패';

        // 2. 방송 없음(NOT_ACTIVE) -> WebSocket 대기 모드 진입
        if (code === 'SESSION_NOT_ACTIVE') {
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

        } else if (code === 'UNAUTHORIZED') {
          dispatch({ type: 'UNAUTHORIZED' });
        } else {
          dispatch({ type: 'ERROR', message: msg });
        }
      }
    };

    tryJoin();

    return () => {
      isActive = false;
      // 🛠 개선: "내가 만든 소켓"일 때만 닫음 (다른 effect 주기의 소켓 건드리지 않음)
      if (mySc) {
        mySc.close();
        if (waitingScRef.current === mySc) {
          waitingScRef.current = null;
        }
      }
    };
  }, [channelId, attempt, connect]);
  const reload = useCallback(() => window.location.reload(), []);
  // ---- 화면 분기 (REST join 결과 기준) ----
  if (!channelId) {
    return (
      <div className="viewerPage__paramError">
        <Card className="p-3">
          <h2>잘못된 접근</h2>
          <p>channelId(roomId)가 없습니다.</p>
        </Card>
      </div>
    );
  }
  // 로그인 필요 분기
  if (joinUi.kind === 'unauthorized') {
    return (
      <div className="viewerPage__paramError">
        <Card className="p-3">
          <h2>로그인이 필요합니다.</h2>
          <p>채널: {channelId}</p>
          <Button onClick={() => (window.location.href = '/login')}>로그인</Button>
        </Card>
      </div>
    );
  }
  if (joinUi.kind === 'error') {
    return (
      <div className="viewerPage__paramError">
        <Card className="p-3">
          <h2>오류</h2>
          <p>{joinUi.message}</p>
          <Button onClick={startJoin}>다시 시도</Button>
          <Button onClick={reload}>새로고침</Button>
        </Card>
      </div>
    );
  }
  // ---- 정상 화면 ----
  return (
    <div className="viewerPage">
      {/* 헤더 영역 */}
      <div className="viewerPage__header">
        <h1 className="viewerPage__title">Viewer</h1>
      </div>
      {/* 상태 정보 카드 */}
      <Card className="p-3 viewerPage__statusCard">
        <div className="viewerPage__infoRow">
          <span className="viewerPage__infoLabel">Channel ID:</span>
          <span>{channelId}</span>
        </div>
        <div className="viewerPage__infoRow">
          <span className="viewerPage__infoLabel">Status:</span>
          <span>{status}</span>
        </div>

        {joinUi.kind === 'joining' && <div className="viewerPage__infoRow">세션 확인 중...</div>}
        {error && <div className="viewerPage__error">{error}</div>}
      </Card>
      {/* 미디어 영역 */}
      <div className="viewerPage__mediaArea">
        <ViewerMediaPanel
          status={status}
          stream={remoteStream}
          muted={false}
          onRetry={startJoin}          // ✅ reconnect
          onReload={reload}            // ✅ fallback
        />
      </div>
      {/* 방송 종료 감지 시 모달 표시 */}
      <Modal
        open={joinUi.kind === 'notActive'}
        title="방송 대기중"
        primaryLabel="홈으로 이동"
        onPrimary={() => navigate('/', { replace: true })}
      >
        <p>호스트가 방송을 준비하고 있습니다.</p>
        <p>방송이 시작되면 자동으로 연결됩니다.</p>
      </Modal>
    </div>
  );
}