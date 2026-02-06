export type Role = "HOST" | "GUEST" | "SC";

export type MsgType =
    | "SYS_ATTACH"
    | "SYS_ACK"
    | "SYS_PING"
    | "SYS_PONG"
    | "SYS_ERROR"
    | "SYS_SESSION_STARTED"  // <-- 추가됨
    | "SESSION_LIVE_STARTED" // <-- 추가됨 (백엔드 스펙 혼용 대비)
    | "SYS_VIEWER_COUNT"     // <-- 추가됨 (시청자 수)
    | "SIG_OFFER"
    | "SIG_ANSWER"
    | "SIG_ICE"
    | "SIG_HANGUP";

export type EnvelopeBase = {
    v: 1;
    type: MsgType;
    requestId: string;
    ts: number;
    channelId: string;
    sessionId: string;
    from: {
        role: Role;
        clientId: string;
    };
    payload: unknown;
};

export type SysSessionStarted = EnvelopeBase & {
    type: "SYS_SESSION_STARTED" | "SESSION_LIVE_STARTED";
    payload: { title?: string; startedAt?: string }; // 필요한 페이로드 정의
};

export type SysViewerCount = EnvelopeBase & {
    type: "SYS_VIEWER_COUNT";
    payload: { count: number };
};

export type SysAttach = EnvelopeBase & {
    type: "SYS_ATTACH";
    payload: { resume?: boolean };
};

export type SysAck = EnvelopeBase & {
    type: "SYS_ACK";
    payload: { status: "OK" };
};

export type SysPing = EnvelopeBase & {
    type: "SYS_PING";
    payload: { seq: number };
};

export type SysPong = EnvelopeBase & {
    type: "SYS_PONG";
    payload: { seq: number };
};

export type SysErrorCode =
    | "UNAUTHORIZED"
    | "INVALID_CLIENT_ID"
    | "INVALID_STATE"
    | "SESSION_NOT_ACTIVE"
    | "DUPLICATE_HOST"
    | "MEDIA_UNAVAILABLE"
    | "RATE_LIMITED";

export type SysError = EnvelopeBase & {
    type: "SYS_ERROR";
    payload: { code: SysErrorCode | string; msg?: string };
};

export type SigOffer = EnvelopeBase & {
    type: "SIG_OFFER";
    payload: { sdpType: "offer"; sdp: string };
};

export type SigAnswer = EnvelopeBase & {
    type: "SIG_ANSWER";
    payload: { sdpType: "answer"; sdp: string };
};

export type SigIce = EnvelopeBase & {
    type: "SIG_ICE";
    payload: { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null };
};

export type SigHangup = EnvelopeBase & {
    type: "SIG_HANGUP";
    payload: { reason?: string };
};

export type AnyInbound =
    | SysAck
    | SysPing
    | SysPong
    | SysError
    | SigAnswer
    | SigIce
    | SysSessionStarted;

export type AnyOutbound =
    | SysAttach
    | SysPong
    | SigOffer
    | SigAnswer
    | SigIce
    | SigHangup;

export type SessionContext = {
    channelId: string;
    sessionId: string;
    role: Exclude<Role, "SC">; // HOST | GUEST
    clientId: string;
};
