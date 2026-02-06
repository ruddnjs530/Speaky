import { Client, type IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import type {
  AnyInbound,
  AnyOutbound,
  EnvelopeBase,
  SessionContext,
  SysAttach,
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

  // 옵션: 초기 연결 시 resume 플래그 설정
  initialResume?: boolean;
};

export class SignalingClient {
  private client: Client | null = null;
  private hasSentAttach = false;
  private hasConnectedOnce = false; // 첫 연결 vs 재연결 구분 플래그

  private readonly ctx: SessionContext;
  private readonly handlers: Handlers;

  constructor(
    ctx: SessionContext,
    handlers: Handlers = {}
  ) {
    this.ctx = ctx;
    this.handlers = handlers;
    // initialResume 옵션이 있다면 hasConnectedOnce를 true로 초기화하여 첫 attach에서 resume: true를 보내도록 유도하거나,
    // attach 호출 시점에 로직을 수정. 
    // 여기서는 handlers.initialResume 값을 저장해둠.
  }

  connect(baseWsUrl: string, token: string) {
    if (this.client?.active) {
      console.warn("STOMP Client already active");
      return;
    }

    const url = buildWsUrl(baseWsUrl, token).replace(/^ws/, 'http');
    // SockJS는 http/https 주소를 사용합니다.
    // brokerURL 대신 webSocketFactory를 사용합니다.

    this.client = new Client({
      // brokerURL: ... (SockJS 사용 시 제거)
      webSocketFactory: () => new SockJS(url),
      // 기본 하트비트: 수신 10000ms, 발신 10000ms
      // 이 하트비트가 앱 레벨의 ping/pong을 대체합니다.
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      reconnectDelay: 5000,

      onConnect: () => {
        signalingTrace.pushWs("OPEN", "STOMP Connected");

        this.handlers.onOpen?.();

        // 채널 토픽 구독
        // 토픽: /topic/channel/{channelId}
        this.client?.subscribe(`/topic/channel/${this.ctx.channelId}`, (message: IMessage) => {
          this.handleStompMessage(message.body);
        });

        // SYS_ATTACH 전송
        // hasConnectedOnce 플래그를 사용하여 resume 여부 결정
        // 추가: initialResume 옵션이 있으면 첫 연결 시에도 resume: true 전송
        const resume = this.hasConnectedOnce || (!!this.handlers.initialResume);
        this.attach(resume);

        this.hasConnectedOnce = true;
      },

      onStompError: (frame) => {
        signalingTrace.pushWs("ERROR", frame.headers['message']);
        console.error('Broker reported error: ' + frame.headers['message']);
        console.error('Additional details: ' + frame.body);
      },

      onWebSocketClose: () => {
        signalingTrace.pushWs("CLOSE", "STOMP WebSocket Closed");
        this.handlers.onClose?.(0, "STOMP_CLOSE");
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

  close() {
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
      return;
    }

    signalingTrace.pushIn(env);
    this.handlers.onMessage?.(env);

    const inbound = this.tryDecodeInbound(env);
    if (!inbound) return;

    // 앱 레벨 PING/PONG 로직 제거됨 (STOMP 하트비트 사용)

    this.handlers.onInbound?.(inbound);
  }

  private sendRaw(env: AnyOutbound, opt: { requireAttachFirst: boolean }) {
    if (!this.client || !this.client.connected) {
      return;
    }

    if (opt.requireAttachFirst && !this.hasSentAttach) {
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
      case "SYS_SESSION_STARTED":
      case "SESSION_LIVE_STARTED":
        return env as any;
      case "SYS_VIEWER_COUNT": { // payload: { count: number }
        const count = (env.payload as any)?.count;
        if (typeof count === "number") return env as any;
        this.handlers.onDrop?.("BAD_SYS_VIEWER_COUNT_PAYLOAD");
        return null;
      }
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
