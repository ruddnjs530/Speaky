import type { Envelope, Role } from "./envelope";
import { createEnvelope } from "./envelope";
import { parseEnvelope } from "./parse";
import { signalingTrace } from "./trace"; // ✅ 추가

type Handlers = {
  onOpen?: () => void;
  onClose?: (ev: CloseEvent) => void;
  onError?: (ev: Event) => void;
  onMessage?: (msg: Envelope) => void;
};

type SendOpts = {
  channelId: string;
  sessionId: string;
  from: { role: Role; clientId?: string };
  requestId?: string;
  ts?: number;
};

export class SignalingClient {
  private ws: WebSocket | null = null;
  private handlers: Handlers;

  constructor(handlers: Handlers = {}) {
    this.handlers = handlers;
  }

  connect(wsUrl: string, token: string) {
    if (
        this.ws &&
        (this.ws.readyState === WebSocket.OPEN ||
            this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const url = this.buildUrl(wsUrl, token);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      signalingTrace.pushWs("OPEN");
      this.handlers.onOpen?.();
    };

    this.ws.onclose = (ev) => {
      signalingTrace.pushWs("CLOSE", `code=${ev.code}${ev.reason ? ` reason=${ev.reason}` : ""}`);
      this.handlers.onClose?.(ev);
    };

    this.ws.onerror = (ev) => {
      signalingTrace.pushWs("ERROR");
      this.handlers.onError?.(ev);
    };

    this.ws.onmessage = (ev) => {
      const env = parseEnvelope(ev.data, "[Signaling]");
      if (!env) return;

      signalingTrace.pushIn(env); // ✅ 수신 트레이스
      this.handlers.onMessage?.(env);
    };
  }

  send(envelope: Envelope) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket이 연결되어 있지 않습니다.");
    }

    signalingTrace.pushOut(envelope); // ✅ 송신 트레이스
    this.ws.send(JSON.stringify(envelope));
  }

  sendMessage<T>(type: string, opts: SendOpts, payload?: T): Envelope<T> {
    const env = createEnvelope<T>(type, opts, payload);
    this.send(env as Envelope);
    return env;
  }

  close(code?: number, reason?: string) {
    this.ws?.close(code, reason);
    this.ws = null;
  }

  private buildUrl(wsUrl: string, token: string) {
    const u = new URL(wsUrl, window.location.origin);
    u.searchParams.set("token", token);

    const s = u.toString();
    if (s.startsWith("https://")) return s.replace("https://", "wss://");
    if (s.startsWith("http://")) return s.replace("http://", "ws://");
    return s;
  }
}
