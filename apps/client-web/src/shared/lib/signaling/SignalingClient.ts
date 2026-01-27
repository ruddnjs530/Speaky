import type {
  AnyInbound,
  AnyOutbound,
  EnvelopeBase,
  SessionContext,
  SysAttach,
  SysPong,
} from "./protocol";
import { parseEnvelope } from "./validate";
import { newRequestId } from "./ids";
import { buildWsUrl } from "./wsUrl";
import { signalingTrace } from "./trace";

type Handlers = {
  onOpen?: () => void;
  onClose?: (code: number, reason: string) => void;
  onMessage?: (env: EnvelopeBase) => void;
  onInbound?: (msg: AnyInbound) => void;
  onDrop?: (reason: string, raw?: string) => void;

  onReconnectAttempt?: (attempt: number, delayMs: number) => void;
  onReconnected?: () => void;
  onError?: (ev: Event) => void;
};

export class SignalingClient {
  private ws: WebSocket | null = null;
  private hasSentAttach = false;

  private lastWsUrl: string | null = null;
  private lastToken: string | null = null;
  private manualClose = false;
  private reconnectAttempt = 0;
  private reconnectTimer: number | null = null;

  private pingTimer: number | null = null;

  private readonly ctx: SessionContext;
  private readonly handlers: Handlers;

  constructor(
    ctx: SessionContext,
    handlers: Handlers = {}
  ) {
    this.ctx = ctx;
    this.handlers = handlers;
  }

  connect(baseWsUrl: string, token: string) {
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        throw new Error("WS_ALREADY_CONNECTED");
      }
    }

    this.manualClose = false;
    this.lastWsUrl = baseWsUrl;
    this.lastToken = token;

    this.openWs(baseWsUrl, token);
  }

  // 규칙 준수: 첫 메시지 SYS_ATTACH
  attach(resume = false) {
    const msg = this.build("SYS_ATTACH", { resume }) as SysAttach;
    this.sendRaw(msg, { requireAttachFirst: false });
    this.hasSentAttach = true;
  }

  send(msg: AnyOutbound) {
    this.sendRaw(msg, { requireAttachFirst: true });
  }

  // 권장: 타입+payload로 보내면 항상 메타 자동 주입
  sendTyped<TType extends AnyOutbound["type"]>(
    type: TType,
    payload: Extract<AnyOutbound, { type: TType }>["payload"]
  ) {
    const env = this.build(type, payload as any) as AnyOutbound;
    this.sendRaw(env, { requireAttachFirst: type !== "SYS_ATTACH" });
  }

  close(code?: number, reason?: string) {
    this.manualClose = true;
    this.clearReconnect();
    this.clearPingPong();
    this.ws?.close(code, reason);
    this.ws = null;
  }

  private openWs(baseWsUrl: string, token: string) {
    const url = buildWsUrl(baseWsUrl, token);
    const finalUrl = url.replace(/^http/, 'ws');

    this.ws = new WebSocket(finalUrl);

    this.ws.onopen = () => {
      signalingTrace.pushWs("OPEN");
      this.reconnectAttempt = 0;
      this.clearReconnect();
      this.startPingPong();

      this.handlers.onOpen?.();

      if (this.reconnectAttempt > 0) {
        this.handlers.onReconnected?.();

        try {
          this.attach(true);
        } catch { }
      } else {
      }
    };

    this.ws.onclose = (e) => {
      signalingTrace.pushWs("CLOSE", `code=${e.code} reason=${e.reason}`);
      this.handlers.onClose?.(e.code, e.reason || "");

      this.ws = null;
      this.hasSentAttach = false;
      this.clearPingPong();

      if (!this.manualClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (e) => {
      signalingTrace.pushWs("ERROR");
      this.handlers.onError?.(e);
    };

    this.ws.onmessage = (e) => {
      const raw = String(e.data ?? "");
      const parsed = parseEnvelope(raw);
      if (!parsed.ok) {
        this.handlers.onDrop?.(parsed.reason, raw);
        return;
      }

      const env = parsed.value;
      signalingTrace.pushIn(env);

      this.handlers.onMessage?.(env);

      // 최소 inbound 디코딩, 자동 처리(PING->PONG)
      const inbound = this.tryDecodeInbound(env);
      if (!inbound) return;

      // SYS_PING 자동 응답 (Server initiated)
      if (inbound.type === "SYS_PING") {
        const seq = (inbound as any).payload?.seq;
        if (typeof seq === "number") this.sendPong(seq);
      }

      this.handlers.onInbound?.(inbound);
    };
  }

  private scheduleReconnect() {
    this.clearReconnect();
    this.reconnectAttempt += 1;

    const base = 300;
    const max = 5000;
    const delay = Math.min(max, base * Math.pow(2, this.reconnectAttempt - 1));

    this.handlers.onReconnectAttempt?.(this.reconnectAttempt, delay);

    this.reconnectTimer = window.setTimeout(() => {
      if (this.manualClose || !this.lastWsUrl || !this.lastToken) return;
      try {
        this.openWs(this.lastWsUrl, this.lastToken);
      } catch {
        this.scheduleReconnect();
      }
    }, delay);
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startPingPong() {
    this.clearPingPong();

    this.pingTimer = window.setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      if (!this.hasSentAttach) return;

      try {
        const seq = Date.now();
        const ping = this.build("SYS_PING", { seq }) as any;
        this.sendRaw(ping, { requireAttachFirst: true });
      } catch { }
    }, 15000);
  }

  private clearPingPong() {
    if (this.pingTimer) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private sendPong(seq: number) {
    const pong = this.build("SYS_PONG", { seq }) as SysPong;
    this.sendRaw(pong, { requireAttachFirst: true });
  }

  private sendRaw(env: AnyOutbound, opt: { requireAttachFirst: boolean }) {
    if (!this.ws) throw new Error("WS_NOT_CONNECTED");
    if (this.ws.readyState !== WebSocket.OPEN) throw new Error("WS_NOT_OPEN");

    if (opt.requireAttachFirst && !this.hasSentAttach) {
      throw new Error("PROTOCOL_VIOLATION_FIRST_MESSAGE_MUST_BE_SYS_ATTACH");
    }

    const text = JSON.stringify(env);
    signalingTrace.pushOut(env as any);
    this.ws.send(text);
  }

  private build<T extends EnvelopeBase["type"]>(type: T, payload: any) {
    return {
      v: 1,
      type,
      requestId: newRequestId(),
      ts: Date.now(),
      channelId: this.ctx.channelId,
      sessionId: this.ctx.sessionId,
      from: {
        role: this.ctx.role,
        clientId: this.ctx.clientId,
      },
      payload,
    } as EnvelopeBase;
  }

  private tryDecodeInbound(env: EnvelopeBase): AnyInbound | null {
    // 타입별 최소 payload 형태만 체크
    switch (env.type) {
      case "SYS_ACK": {
        const status = (env.payload as any)?.status;
        if (status === "OK") return env as any;
        this.handlers.onDrop?.("BAD_SYS_ACK_PAYLOAD");
        return null;
      }
      case "SYS_ERROR": {
        const code = (env.payload as any)?.code;
        if (typeof code === "string") return env as any;
        this.handlers.onDrop?.("BAD_SYS_ERROR_PAYLOAD");
        return null;
      }
      case "SYS_PING":
      case "SYS_PONG":
        return env as any;
      case "SIG_ANSWER": {
        const sdp = (env.payload as any)?.sdp;
        const sdpType = (env.payload as any)?.sdpType;
        if (sdpType === "answer" && typeof sdp === "string") return env as any;
        this.handlers.onDrop?.("BAD_SIG_ANSWER_PAYLOAD");
        return null;
      }
      case "SIG_ICE": {
        const c = (env.payload as any)?.candidate;
        if (typeof c === "string") return env as any;
        this.handlers.onDrop?.("BAD_SIG_ICE_PAYLOAD");
        return null;
      }
      default:
        // inbound로 안 쓰는 타입은 무시
        return null;
    }
  }
}
