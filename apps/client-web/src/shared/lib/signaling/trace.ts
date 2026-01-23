import type { Envelope } from "./envelope";

export type TraceDir = "in" | "out" | "ws";

export type TraceItem = {
    id: string;
    dir: TraceDir;

    at: number; // ms
    type: string;
    requestId?: string;

    channelId?: string;
    sessionId?: string;

    fromRole?: string;
    fromClientId?: string;

    summary?: string;
    raw?: unknown; // dev only
};

type Listener = (items: TraceItem[]) => void;

const MAX = 500;

let items: TraceItem[] = [];
const listeners = new Set<Listener>();

function emit() {
    const snapshot = items;
    listeners.forEach((l) => l(snapshot));
}

function push(item: TraceItem) {
    items = [item, ...items].slice(0, MAX);
    emit();
}

function uuidLike(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (crypto as any).randomUUID();
    }
    return `trace_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function summarizeEnvelope(env: Envelope): string {
    // payload 요약: SDP는 길이만, ICE는 candidate prefix만
    const p = (env.payload ?? {}) as Record<string, unknown>;

    if (env.type === "SIG_OFFER" || env.type === "SIG_ANSWER") {
        const sdp = typeof p.sdp === "string" ? p.sdp : "";
        return `sdpLen=${sdp.length}`;
    }

    if (env.type === "SIG_ICE") {
        const c = typeof p.candidate === "string" ? p.candidate : "";
        const head = c ? c.slice(0, 60) : "";
        return `candidate="${head}${c.length > 60 ? "…" : ""}"`;
    }

    if (env.type === "SYS_ERROR") {
        const code = typeof p.code === "string" ? p.code : "SYS_ERROR";
        const msg = typeof p.msg === "string" ? p.msg : "";
        return msg ? `${code}: ${msg}` : code;
    }

    if (env.type === "SYS_ATTACH") {
        const resume = typeof p.resume === "boolean" ? p.resume : false;
        return `resume=${String(resume)}`;
    }

    // 기본: payload key 개수
    const keys = Object.keys(p);
    return keys.length ? `payloadKeys=${keys.join(",")}` : "";
}

export const signalingTrace = {
    subscribe(listener: Listener) {
        listeners.add(listener);
        listener(items);
        return () => {
            listeners.delete(listener);
        }
    },

    clear() {
        items = [];
        emit();
    },

    pushWs(event: "OPEN" | "CLOSE" | "ERROR", detail?: string) {
        push({
            id: uuidLike(),
            dir: "ws",
            at: Date.now(),
            type: `WS_${event}`,
            summary: detail,
        });
    },

    pushIn(env: Envelope) {
        push({
            id: uuidLike(),
            dir: "in",
            at: Date.now(),
            type: env.type,
            requestId: env.requestId,
            channelId: env.channelId,
            sessionId: env.sessionId,
            fromRole: env.from?.role,
            fromClientId: env.from?.clientId,
            summary: summarizeEnvelope(env),
            raw: env,
        });
    },

    pushOut(env: Envelope) {
        push({
            id: uuidLike(),
            dir: "out",
            at: Date.now(),
            type: env.type,
            requestId: env.requestId,
            channelId: env.channelId,
            sessionId: env.sessionId,
            fromRole: env.from?.role,
            fromClientId: env.from?.clientId,
            summary: summarizeEnvelope(env),
            raw: env,
        });
    },
};
// DEV only: console QA용 노출
if (import.meta.env.DEV) {
    (window as any).__signalingTrace = signalingTrace;
}
