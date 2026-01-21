import type { Envelope, Role } from './envelope';
import { createEnvelope } from './envelope';
import { parseEnvelope } from './parse';

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

    this.ws.onopen = () => this.handlers.onOpen?.();
    this.ws.onclose = (ev) => this.handlers.onClose?.(ev);
    this.ws.onerror = (ev) => this.handlers.onError?.(ev);

    this.ws.onmessage = (ev) => {
      const env = parseEnvelope(ev.data, '[Signaling]');
      if (!env) return; // 필수 필드 누락, 형식 오류면 드랍

      this.handlers.onMessage?.(env);
    };
  }

  send(envelope: Envelope) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket이 연결되어 있지 않습니다.');
    }
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
    u.searchParams.set('token', token);

    // wsUrl이 http(s)로 들어오면 ws(s)로 교체
    const s = u.toString();
    if (s.startsWith('https://')) return s.replace('https://', 'wss://');
    if (s.startsWith('http://')) return s.replace('http://', 'ws://');
    return s; // 이미 ws:// or wss:// 라면 그대로
  }
}
