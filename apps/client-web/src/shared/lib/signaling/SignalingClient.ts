import type { Envelope, Role } from './envelope';
import { createEnvelope } from './envelope';
import { parseEnvelope } from './parse';
import { signalingTrace } from './trace';

export type SendOpts = {
  channelId: string;
  sessionId: string;
  from: { role: Role; clientId?: string };
};

type Context = SendOpts;

type Handlers = {
  onOpen?: () => void;
  onClose?: (ev: CloseEvent) => void;
  onError?: (ev: Event) => void;
  onMessage?: (msg: Envelope) => void;

  // 디버그용
  onReconnectAttempt?: (attempt: number, delayMs: number) => void;
  onReconnected?: () => void;
};

type SysAttachPayload = { resume?: boolean };

export class SignalingClient {
  private ws: WebSocket | null = null;
  private handlers: Handlers;

  private lastWsUrl: string | null = null;
  private lastToken: string | null = null;

  private context: Context | null = null;

  private manualClose = false;

  private reconnectAttempt = 0;
  private reconnectTimer: number | null = null;

  // 핑/퐁(선택)
  private pingTimer: number | null = null;
  private pongTimer: number | null = null;

  constructor(handlers: Handlers) {
    this.handlers = handlers;
  }

  setContext(ctx: Context) {
    this.context = ctx;
  }

  connect(wsUrl: string, token: string) {
    this.manualClose = false;
    this.lastWsUrl = wsUrl;
    this.lastToken = token;

    this.openWs(wsUrl, token);
  }

  close() {
    this.manualClose = true;

    this.clearReconnect();
    this.clearPingPong();

    try {
      this.ws?.close();
    } catch {
      // ignore
    } finally {
      this.ws = null;
    }
  }

  send(envelope: Envelope) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    const raw = JSON.stringify(envelope);
    signalingTrace.pushOut(envelope);
    this.ws.send(raw);
  }

  // createEnvelope 새 시그니처에 맞춘 버전
  sendMessage<TPayload>(type: string, opts: SendOpts, payload?: TPayload) {
    const env = createEnvelope<TPayload>(
      type,
      {
        channelId: opts.channelId,
        sessionId: opts.sessionId,
        from: opts.from, // clientId 없으면 envelope.ts에서 localStorage 기반으로 채움
      },
      payload
    );

    this.send(env);
  }

  // -------------------------
  // Internals
  // -------------------------

  private openWs(wsUrl: string, token: string) {
    const url = this.buildUrl(wsUrl, token);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      signalingTrace.pushWs('OPEN');
      this.reconnectAttempt = 0;
      this.clearReconnect();
      this.startPingPong();

      // 재연결 시 resume attach 자동 전송
      if (this.context) {
        try {
          this.sendMessage<SysAttachPayload>('SYS_ATTACH', this.context, {
            resume: true,
          });
        } catch {
          // ignore
        }
      }

      this.handlers.onOpen?.();
      this.handlers.onReconnected?.();
    };

    this.ws.onclose = (ev) => {
      signalingTrace.pushWs(
        'CLOSE',
        `code=${ev.code}${ev.reason ? ` reason=${ev.reason}` : ''}`
      );

      this.clearPingPong();
      this.handlers.onClose?.(ev);

      if (this.manualClose) return;
      this.scheduleReconnect();
    };

    this.ws.onerror = (ev) => {
      signalingTrace.pushWs('ERROR');
      this.handlers.onError?.(ev);
    };

    this.ws.onmessage = (ev) => {
      const env = parseEnvelope(ev.data, '[Signaling]');
      if (!env) return;

      signalingTrace.pushIn(env);
      this.handlers.onMessage?.(env);
    };
  }

  private scheduleReconnect() {
    this.clearReconnect();

    this.reconnectAttempt += 1;
    const base = 300;
    const max = 5_000;
    const delay = Math.min(max, base * Math.pow(2, this.reconnectAttempt - 1));

    this.handlers.onReconnectAttempt?.(this.reconnectAttempt, delay);

    this.reconnectTimer = window.setTimeout(() => {
      if (this.manualClose) return;
      if (!this.lastWsUrl || !this.lastToken) return;

      try {
        this.openWs(this.lastWsUrl, this.lastToken);
      } catch {
        this.scheduleReconnect();
      }
    }, delay);
  }

  private clearReconnect() {
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private startPingPong() {
    this.clearPingPong();

    this.pingTimer = window.setInterval(() => {
      if (!this.context) return;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      try {
        this.sendMessage('SYS_PING', this.context, { ts: Date.now() });
      } catch {
        // ignore
      }

      if (this.pongTimer) window.clearTimeout(this.pongTimer);
      this.pongTimer = window.setTimeout(() => {
        // 정책 강화 가능
      }, 20_000);
    }, 15_000);
  }

  private clearPingPong() {
    if (this.pingTimer) window.clearInterval(this.pingTimer);
    this.pingTimer = null;

    if (this.pongTimer) window.clearTimeout(this.pongTimer);
    this.pongTimer = null;
  }

  private buildUrl(wsUrl: string, token: string) {
    const u = new URL(wsUrl, window.location.origin);
    u.searchParams.set('token', token);

    const s = u.toString();
    if (s.startsWith('https://')) return s.replace('https://', 'wss://');
    if (s.startsWith('http://')) return s.replace('http://', 'ws://');
    return s;
  }
}
