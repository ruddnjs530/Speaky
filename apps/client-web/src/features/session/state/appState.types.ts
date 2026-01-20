export type Role = "HOST" | "GUEST";

export type AppStateKind =
    | "Idle"
    | "SessionReady"     // REST 성공(세션 메타 확보)
    | "WsConnecting"     // (Day2) WSS 연결 시도
    | "Attached"         // (Day2) SYS_ATTACH 성공
    | "PcConnecting"     // (Day2) offer/answer 교환 중
    | "Connected"        // (Day2) WebRTC 연결 완료
    | "Reconnecting"
    | "Error";

export type SysErrorCode =
    | "UNAUTHORIZED"
    | "INVALID_CLIENT_ID"
    | "INVALID_STATE"
    | "SESSION_NOT_ACTIVE"
    | "DUPLICATE_HOST"
    | "MEDIA_UNAVAILABLE"
    | "RATE_LIMITED"
    // Day1에서 REST 에러도 동일 포맷으로 흡수할 수 있게 확장
    | "REST_ERROR"
    | "UNKNOWN";

export interface AppError {
    code: SysErrorCode;
    message: string;
    requestId?: string; // SYS_ERROR가 특정 requestId와 연관될 때
}

export interface AppStateContext {
    channelId: string | null;
    sessionId: string | null;
    role: Role | null;

    wsUrl: string | null;            // wss://.../ws/signaling
    signalingToken: string | null;   // token
    clientId: string | null;         // web-xxxxxxxx (탭 단위, 불변)

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
