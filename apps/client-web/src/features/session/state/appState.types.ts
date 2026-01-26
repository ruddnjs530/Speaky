export type Role = "HOST" | "GUEST";

export type AppStateKind =
    | "Idle"
    | "SessionReady"     // REST 성공 (세션 메타 확보)
    | "WsConnecting"     // WSS 연결 시도 중
    | "Attached"         // SYS_ATTACH 성공 (시그널링 준비 완료)
    | "PcConnecting"     // WebRTC Negotiation 중 (Offer/Answer)
    | "Connected"        // WebRTC 연결 완료 (미디어 스트림 가능)
    | "Reconnecting"     // 재연결 시도 중
    | "Error";           // 치명적 에러

// 에러 코드별 유저 액션 정의
export type SysErrorCode =
    | "UNAUTHORIZED"       // -> 로그인 이동
    | "INVALID_CLIENT_ID"  // -> 새로고침/재접속
    | "INVALID_STATE"      // -> 새로고침/재접속
    | "SESSION_NOT_ACTIVE" // -> 홈 이동 + 안내
    | "DUPLICATE_HOST"     // -> Host 전용 안내 + 종료
    | "MEDIA_UNAVAILABLE"  // -> 재시도 + 실패 시 안내
    | "RATE_LIMITED"       // -> 대기 안내
    | "REST_ERROR"         // (Fallback)
    | "UNKNOWN";           // (Fallback)

export interface AppError {
    code: SysErrorCode;
    message: string;
    requestId?: string;
}

export interface AppStateContext {
    channelId: string | null;
    sessionId: string | null;
    role: Role | null;

    wsUrl: string | null;
    signalingToken: string | null;
    clientId: string | null;    // A파트에서 주입받음

    lastError: AppError | null;
}

export type AppState =
    | { kind: "Idle"; context: AppStateContext }
    | { kind: "SessionReady"; context: AppStateContext }
    | { kind: "WsConnecting"; context: AppStateContext }
    | { kind: "Attached"; context: AppStateContext }
    | { kind: "PcConnecting"; context: AppStateContext }
    | { kind: "Connected"; context: AppStateContext }
    | { kind: "Reconnecting"; context: AppStateContext }
    | { kind: "Error"; context: AppStateContext };

export const initialContext = (): AppStateContext => ({
    channelId: null,
    sessionId: null,
    role: null,
    wsUrl: null,
    signalingToken: null,
    clientId: null,
    lastError: null,
});

export const initialState = (): AppState => ({
    kind: "Idle",
    context: initialContext(),
});