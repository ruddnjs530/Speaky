// apps/client-web/src/shared/lib/signaling/SignalingClient.ts
import type { Envelope, Role } from './envelope';
import { createEnvelope } from './envelope';
import { parseEnvelope } from './parse';

type Handlers = {
  onOpen?: () => void;
  onClose?: (ev: CloseEvent) => void;
  onError?: (ev: Event) => void;
  onMessage?: (msg: Envelope) => void;

  // 디버그용
  onReconnectAttempt?: (attempt: number, delayMs: number) => void;
  onReconnected?: () => void;
};

export type SendOpts = {
  channelId: string;
  sessionId: string;
  from: { role: Role; clientId?: string };
  requestId?: string;
  ts?: number;
};

type ReconnectOptions = {
  enabled: boolean;
  baseMs: number;
  maxMs: number;
  factor: number;
  jitterRatio: number;
};

type KeepAliveOptions = {
  enabled: boolean;
  pingIntervalMs: number;
  pongTimeoutMs: number;
};

type ClientOptions = {
  reconnect?: Partial<ReconnectOptions>;
  keepAlive?: Partial<KeepAliveOptions>;
  resumeOnReconnect?: boolean; // default true
};

const DEFAULT_RECONNECT: ReconnectOptions = {
  enabled: true,
  baseMs: 500,
  maxMs: 10_000,
  factor: 1.7,
  jitterRatio: 0.2,
};

const DEFAULT_KEEPALIVE: KeepAliveOptions = {
  enabled: true,
  pingIntervalMs: 20_000,
  pongTimeoutMs: 10_000,
};

export class SignalingClient {
  private ws: WebSocket | null = null;
  private handlers: Handlers;

  private reconnectOpt: ReconnectOptions;
  private keepAliveOpt: KeepAliveOptions;
  private resumeOnReconnect: boolean;

  private manualClose = false;

  // reconnect state
  private attempt = 0;
  private reconnectTimer: number | null = null;

  // keepalive state
  private pingTimer: number | null = null;
  private pongTimer: number | null = null;

  // last connect info
  private lastWsUrl: string | null = null;
  private lastToken: string | null = null;

  // 자동 SYS_* 전송을 위한 기본 컨텍스트
  private defaultSendOpts: SendOpts | null = null;

  constructor(handlers: Handlers = {}, options: ClientOptions = {}) {
    this.handlers = handlers;

    this.reconnectOpt = { ...DEFAULT_RECONNECT, ...(options.reconnect ?? {}) };
    this.keepAliveOpt = { ...DEFAULT_KEEPALIVE, ...(options.keepAlive ?? {}) };
    this.resumeOnReconnect = options.resumeOnReconnect ?? true;
  }

  // SYS_ATTACH/PING/PONG 같은 자동 메시지에 쓸 컨텍스트 저장
  setContext(opts: SendOpts) {
    this.defaultSendOpts = opts;
  }

  connect(wsUrl: string, token: string) {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.manualClose = false;
    this.lastWsUrl = wsUrl;
    this.lastToken = token;

    this.openWs(wsUrl, token);
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

  // 컨텍스트 저장해뒀으면 opts 없이도 보낼 수 있게
  sendAuto<T>(type: string, payload?: T): Envelope<T> | null {
    if (!this.defaultSendOpts) return null;
    return this.sendMessage<T>(type, this.defaultSendOpts, payload);
  }

  close(code?: number, reason?: string) {
    this.manualClose = true;
    this.clearReconnectTimer();
    this.stopKeepAlive();

    this.ws?.close(code, reason);
    this.ws = null;
  }

  // ========= internal =========

  private openWs(wsUrl: string, token: string) {
    this.stopKeepAlive();

    const url = this.buildUrl(wsUrl, token);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      const wasReconnecting = this.attempt > 0;
      this.attempt = 0;

      this.handlers.onOpen?.();

      // 재연결 성공 시 attach(resume:true)
      if (wasReconnecting && this.resumeOnReconnect) {
        this.sendAuto('SYS_ATTACH', { resume: true });
        this.handlers.onReconnected?.();
      }

      if (this.keepAliveOpt.enabled) this.startKeepAlive();
    };

    this.ws.onclose = (ev) => {
      this.handlers.onClose?.(ev);
      this.stopKeepAlive();
      this.ws = null;

      if (this.manualClose) return;
      if (!this.reconnectOpt.enabled) return;

      this.scheduleReconnect();
    };

    this.ws.onerror = (ev) => {
      this.handlers.onError?.(ev);
      // 대개 onclose가 오지만, 안전하게 재연결 스케줄
      if (this.manualClose) return;
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        if (this.reconnectOpt.enabled) this.scheduleReconnect();
      }
    };

    this.ws.onmessage = (ev) => {
      const env = parseEnvelope(ev.data, '[Signaling]');
      if (!env) return;

      // 서버가 PING을 보내는 경우: PONG 응답
      if (env.type === 'SYS_PING') {
        this.sendAuto('SYS_PONG', { ts: Date.now() });
        return;
      }

      // 우리가 보낸 PING의 응답(PONG) 처리
      if (env.type === 'SYS_PONG') {
        this.clearPongTimeout();
        return;
      }

      this.handlers.onMessage?.(env);
    };
  }

  private scheduleReconnect() {
    this.clearReconnectTimer();

    const cfg = this.reconnectOpt;
    const exp = cfg.baseMs * Math.pow(cfg.factor, this.attempt++);
    const capped = Math.min(exp, cfg.maxMs);

    const jitter = capped * cfg.jitterRatio;
    const delay = Math.max(0, capped + (Math.random() * 2 - 1) * jitter);

    this.handlers.onReconnectAttempt?.(this.attempt, Math.round(delay));

    this.reconnectTimer = window.setTimeout(() => {
      if (this.manualClose) return;
      if (!this.lastWsUrl || !this.lastToken) return;

      this.openWs(this.lastWsUrl, this.lastToken);
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private startKeepAlive() {
    this.stopKeepAlive();

    const { pingIntervalMs, pongTimeoutMs } = this.keepAliveOpt;

    this.pingTimer = window.setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      // 최소 keep-alive (컨텍스트 없으면 스킵)
      const sent = this.sendAuto('SYS_PING', { ts: Date.now() });
      if (!sent) return;

      // PONG 안 오면 강제 close -> onclose에서 재연결
      this.clearPongTimeout();
      this.pongTimer = window.setTimeout(() => {
        try {
          this.ws?.close(4000, 'pong_timeout');
        } catch {}
      }, pongTimeoutMs);
    }, pingIntervalMs);
  }

  private stopKeepAlive() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
    this.clearPongTimeout();
  }

  private clearPongTimeout() {
    if (this.pongTimer) clearTimeout(this.pongTimer);
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
