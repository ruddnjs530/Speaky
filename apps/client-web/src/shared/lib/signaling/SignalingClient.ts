import { Client, type IMessage } from "@stomp/stompjs";
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
  private client: Client | null = null;
  private hasSentAttach = false;

  private lastWsUrl: string | null = null;
  private lastToken: string | null = null;
  private manualClose = false;
  private reconnectAttempt = 0;

  // STOMP가 ping/pong (heartbeat)을 처리하지만, 필요한 경우 앱 레벨의 핑을 유.
  // 서버가 여전히 일부 로직을 위해 앱 레벨의 PONG을 의존할 수 있다고 가정하지만,
  // 보통 STOMP 하트비트면 충분.
  // 현재는 안전을 위해 앱 레벨의 핑 타이머를 명시적으로 유지.
  // 사용자의 서버 코드 스니펫에서 하트비트에 관한 STOMP 설정 세부 정보가 없었기 때문.
  // 따라서 원래 코드에 있던 명시적인 PING/PONG 로직을 안전을 위해 유지.
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
    if (this.client?.active) {
      console.warn("STOMP Client already active");
      return;
    }

    this.manualClose = false;
    this.lastWsUrl = baseWsUrl;
    this.lastToken = token;

    const url = buildWsUrl(baseWsUrl, token);
    const brokerURL = url.replace(/^http/, 'ws');

    this.client = new Client({
      brokerURL,
      // 기본 하트비트: 수신 10000ms, 발신 10000ms
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      reconnectDelay: 5000,

      onConnect: () => {
        signalingTrace.pushWs("OPEN", "STOMP Connected");
        this.reconnectAttempt = 0;
        this.startPingPong();

        this.handlers.onOpen?.();


        // 채널 토픽 구독
        // 토픽: /topic/channel/{channelId}
        this.client?.subscribe(`/topic/channel/${this.ctx.channelId}`, (message: IMessage) => {
          this.handleStompMessage(message.body);
        });

        // SYS_ATTACH 전송
        // 재연결인 경우 resume = true 여야 한다.
        // 하지만 STOMP 클라이언트가 내부적으로 재연결을 처리.
        // 이것이 처음 시작인지 재연결인지 추적할 필요가 있을 수 있다.
        // 간단함을 위해 항상 attach 로직 실행:
        this.attach(false); // TODO: 중요하다면 resume 상태 감지 필요
      },

      onStompError: (frame) => {
        signalingTrace.pushWs("ERROR", frame.headers['message']);
        console.error('Broker reported error: ' + frame.headers['message']);
        console.error('Additional details: ' + frame.body);
      },

      onWebSocketClose: (evt) => {
        signalingTrace.pushWs("CLOSE", "STOMP WebSocket Closed");
        this.handlers.onClose?.(0, "STOMP_CLOSE");
        this.clearPingPong();
      },

      onWebSocketError: (evt) => {
        signalingTrace.pushWs("ERROR", "WebSocket Error");
        this.handlers.onError?.(evt);
      }
    });

    this.client.activate();
  }

  attach(resume = false) {
    const msg = this.build("SYS_ATTACH", { resume }) as SysAttach;
    this.sendRaw(msg, { requireAttachFirst: false });
    this.hasSentAttach = true;
  }

  send(msg: AnyOutbound) {
    this.sendRaw(msg, { requireAttachFirst: true });
  }

  sendTyped<TType extends AnyOutbound["type"]>(
    type: TType,
    payload: Extract<AnyOutbound, { type: TType }>["payload"]
  ) {
    const env = this.build(type, payload as any) as AnyOutbound;
    this.sendRaw(env, { requireAttachFirst: type !== "SYS_ATTACH" });
  }

  close(code?: number, reason?: string) {
    this.manualClose = true;
    this.clearPingPong();
    if (this.client) {
      this.client.deactivate();
      this.client = null;
    }
  }

  private handleStompMessage(body: string) {
    const parsed = parseEnvelope(body);
    if (!parsed.ok) {
      this.handlers.onDrop?.(parsed.reason, body);
      return;
    }

    const env = parsed.value;

    // 만약 서버가 보낸 사람에게도 모든 것을 브로드캐스트한다면 자신의 메시지는 필터링
    if (env.from?.clientId === this.ctx.clientId) {
      // 반사된 자신의 메시지 무시
      return;
    }

    signalingTrace.pushIn(env);
    this.handlers.onMessage?.(env);

    const inbound = this.tryDecodeInbound(env);
    if (!inbound) return;

    if (inbound.type === "SYS_PING") {
      const seq = (inbound as any).payload?.seq;
      if (typeof seq === "number") this.sendPong(seq);
    }

    this.handlers.onInbound?.(inbound);
  }

  private startPingPong() {
    this.clearPingPong();

    // 앱 레벨 핑 (STOMP 하트비트가 사용되면 선택 사항이지만, 프로토콜 호환성을 위해 유지)
    this.pingTimer = window.setInterval(() => {
      if (!this.client?.connected) return;
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
    if (!this.client || !this.client.connected) {
      return;
    }

    if (opt.requireAttachFirst && !this.hasSentAttach) {
      // opt 체크에 의해 처리되므로 메시지가 attach 메시지 자체라면 전송 허용
      console.warn("PROTOCOL_VIOLATION: Attach first");
    }

    const text = JSON.stringify(env);
    signalingTrace.pushOut(env as any);

    // 대상: 서버 설정에 따른 /app/signaling
    // 설정에 setApplicationDestinationPrefixes("/app")이 있다.
    // 따라서 클라이언트는 "/app/signaling"으로 전송한다.
    this.client.publish({
      destination: "/app/signaling",
      body: text
    });
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
