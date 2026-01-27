import type { AppError, Role } from "./appState.types";

export type BootstrapPayload = {
    channelId: string;
    sessionId: string;
    role: Role;
    wsUrl: string;
    signalingToken: string;
    clientId: string; // A파트에서 생성한 ID 주입
};

export type AppEvent =
    // 1. Bootstrap (REST)
    | { type: "EV_BOOTSTRAP_START" } // UI 로딩 시작
    | { type: "EV_BOOTSTRAPPED"; payload: BootstrapPayload }
    | { type: "EV_BOOTSTRAP_FAIL"; error: AppError }

    // 2. WebSocket Lifecycle
    | { type: "EV_WS_CONNECTING" }   // [Internal] WS 연결 시도 시작
    | { type: "EV_WS_CONNECTED" }    // [Internal] WS.onopen 발생
    | { type: "EV_ATTACHED_OK" }     // [Server: SYS_ACK] 로부터 매핑. 시그널링 준비 완료

    // 3. WebRTC Signaling (Server -> Client)
    // FE-A의 SignalingClient가 이 메시지들을 수신하면 dispatch(EV_...) 해야 함
    | { type: "EV_GOT_ANSWER"; sdp: string }                 // [Server: SIG_ANSWER] payload.sdp -> sdp
    | { type: "EV_GOT_ICE"; candidate: RTCIceCandidateInit } // [Server: SIG_ICE] payload.candidate -> candidate

    // 4. WebRTC Lifecycle (Client Internal)
    | { type: "EV_PC_CONNECTING" }   // [Internal] Negotiation 시작 (Offer 생성 직전)
    | { type: "EV_PC_CONNECTED" }    // [Internal] PC.connectionState === 'connected'

    // 5. Common / Error
    | { type: "EV_ERROR"; error: AppError } // [Server: SYS_ERROR] payload -> error 변환해서 dispatch
    | { type: "EV_PING"; seq: number }      // [Server: SYS_PING] payload.seq -> seq (선택사항)
    | { type: "EV_RETRY" }                  // [User Action] 재시도 버튼 클릭
    | { type: "EV_RESET" };                 // [Internal] 초기화