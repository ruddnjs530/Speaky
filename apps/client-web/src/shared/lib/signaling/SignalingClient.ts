import type { Envelope, Role } from './envelope';
import { createEnvelope } from './envelope';
import { parseEnvelope } from './parse';
import { signalingTrace } from './trace';

export type SendOpts = {
  channelId: string;
  sessionId: string;
  from: { role: Role };
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

  // 핑/퐁(선택): 서버가 지원하면 keep-alive, 미지원이면 무시될 수 있음
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

  sendMessage<TPayload>(type: Envelope['type'], opts: SendOpts, payload: TPayload) {
    const env = createEnvelope({
      type,
      channelId: opts.channelId,
      sessionId: opts.sessionId,
      from: opts.from,
      payload,
    });
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
      this.reconnectAttempt = 0; // 성공 시 초기화
      this.clearReconnect();
      this.startPingPong();

      // 재연결(open이면서 이전에 끊긴 상태였던 경우) → resume attach 자동 전송
      // (최초 connect 직후에도 context가 있다면 resume:false는 상위 훅에서 보내므로, 여기서는 resume:true만)
      if (this.context) {
        try {
          this.sendMessage<SysAttachPayload>(
            'SYS_ATTACH',
            this.context,
            { resume: true },
          );
        } catch {
          // attach 실패해도 소켓은 살아있을 수 있으므로 여기서 강제 close하지 않음
        }
      }

      this.handlers.onOpen?.();
      this.handlers.onReconnected?.();
    };

    this.ws.onclose = (ev) => {
      signalingTrace.pushWs(
        'CLOSE',
        `code=${ev.code}${ev.reason ? ` reason=${ev.reason}` : ''}`,
      );

      this.clearPingPong();
      this.handlers.onClose?.(ev);

      // 정상 종료(사용자 close)면 재연결하지 않음
      if (this.manualClose) return;

      // 비정상 종료면 재연결 시도
      this.scheduleReconnect();
    };

    this.ws.onerror = (ev) => {
      signalingTrace.pushWs('ERROR');
      this.handlers.onError?.(ev);
      // onclose에서 재연결 트리거되므로 여기서는 별도 처리 최소화
    };

    this.ws.onmessage = (ev) => {
      // 서버가 단순 PONG 문자열 등을 보낼 수 있는 경우를 고려
      const env = parseEnvelope(ev.data, '[Signaling]');
      if (!env) return;

      signalingTrace.pushIn(env);
      this.handlers.onMessage?.(env);
    };
  }

  private scheduleReconnect() {
    this.clearReconnect();

    // 지수 백오프(상한 포함)
    this.reconnectAttempt += 1;
    const base = 300; // ms
    const max = 5_000; // ms
    const delay = Math.min(max, base * Math.pow(2, this.reconnectAttempt - 1));

    this.handlers.onReconnectAttempt?.(this.reconnectAttempt, delay);

    this.reconnectTimer = window.setTimeout(() => {
      if (this.manualClose) return;
      if (!this.lastWsUrl || !this.lastToken) return;

      try {
        this.openWs(this.lastWsUrl, this.lastToken);
      } catch {
        // 실패하면 다음 tick에서 재시도
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

    // 서버가 SYS_PING/SYS_PONG을 지원한다는 가정 하의 keep-alive.
    // 미지원이면 서버가 무시할 수 있으므로, 타임아웃 정책은 공격적으로 두지 않습니다.
    this.pingTimer = window.setInterval(() => {
      if (!this.context) return;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      try {
        this.sendMessage('SYS_PING', this.context, { ts: Date.now() });
      } catch {
        // ignore
      }

      // pong 타임아웃은 선택. 너무 공격적이면 불안정해질 수 있어 넉넉히 둠.
      if (this.pongTimer) window.clearTimeout(this.pongTimer);
      this.pongTimer = window.setTimeout(() => {
        // pong 미수신만으로 즉시 close하지는 않음(네트워크 상황 고려)
        // 필요 시 정책 강화 가능
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
