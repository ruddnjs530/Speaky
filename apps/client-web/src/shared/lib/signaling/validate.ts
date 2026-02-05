import type { EnvelopeBase, MsgType } from "./protocol";

type Ok<T> = { ok: true; value: T };
type Fail = { ok: false; reason: string };
export type ParseResult<T> = Ok<T> | Fail;

export function parseEnvelope(jsonText: string): ParseResult<EnvelopeBase> {
    let obj: unknown;
    try {
        obj = JSON.parse(jsonText);
    } catch {
        return { ok: false, reason: "JSON_PARSE_FAILED" };
    }

    if (!isRecord(obj)) return { ok: false, reason: "NOT_OBJECT" };
    const v = obj.v;
    const type = obj.type;

    if (v !== 1) return { ok: false, reason: "BAD_VERSION" };
    if (!isMsgType(type)) return { ok: false, reason: "BAD_TYPE" };

    // 필수 필드 체크
    const required = ["requestId", "ts", "channelId", "sessionId", "from", "payload"] as const;
    for (const k of required) if (!(k in obj)) return { ok: false, reason: `MISSING_${k}` };

    if (!isRecord(obj.from)) return { ok: false, reason: "BAD_FROM" };
    if (typeof obj.from.role !== "string") return { ok: false, reason: "BAD_FROM_ROLE" };
    if (typeof obj.from.clientId !== "string") return { ok: false, reason: "BAD_FROM_CLIENTID" };

    if (typeof obj.requestId !== "string") return { ok: false, reason: "BAD_REQUEST_ID" };
    if (typeof obj.ts !== "number") return { ok: false, reason: "BAD_TS" };
    if (typeof obj.channelId !== "string") return { ok: false, reason: "BAD_CHANNEL_ID" };
    if (typeof obj.sessionId !== "string") return { ok: false, reason: "BAD_SESSION_ID" };

    return { ok: true, value: obj as EnvelopeBase };
}

function isRecord(v: unknown): v is Record<string, any> {
    return typeof v === "object" && v !== null;
}

function isMsgType(t: unknown): t is MsgType {
    return (
        t === "SYS_ATTACH" ||
        t === "SYS_ACK" ||
        t === "SYS_PING" ||
        t === "SYS_PONG" ||
        t === "SYS_ERROR" ||
        t === "SYS_SESSION_STARTED" ||
        t === "SESSION_LIVE_STARTED" ||
        t === "SYS_VIEWER_COUNT" ||
        t === "SIG_OFFER" ||
        t === "SIG_ANSWER" ||
        t === "SIG_ICE" ||
        t === "SIG_HANGUP"
    );
}
