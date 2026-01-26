import type { AppState } from "./appState.types";
import type { AppEvent } from "./appState.events";

export function appStateReducer(state: AppState, event: AppEvent): AppState {
    // 1. 전역 초기화/에러 처리
    switch (event.type) {
        case "EV_RESET":
            return {
                kind: "Idle",
                context: {
                    channelId: null,
                    sessionId: null,
                    role: null,
                    wsUrl: null,
                    signalingToken: null,
                    clientId: null,
                    lastError: null,
                },
            };

        case "EV_BOOTSTRAP_FAIL":
        case "EV_ERROR":
            return {
                kind: "Error",
                context: {
                    ...state.context,
                    lastError: event.error,
                },
            };
    }

    // 2. 상태별 전이 로직
    switch (state.kind) {
        case "Idle":
        case "Error": {
            if (event.type === "EV_BOOTSTRAPPED") {
                return {
                    kind: "SessionReady",
                    context: {
                        ...state.context,
                        ...event.payload,
                        lastError: null,
                    },
                };
            }
            // 재시도(RETRY) 시 Idle로 가서 다시 Bootstrap 유도
            if (event.type === "EV_RETRY") {
                return {
                    kind: "Idle",
                    context: { ...state.context, lastError: null },
                };
            }
            return state;
        }

        case "SessionReady": {
            // WS 연결 시작
            if (event.type === "EV_WS_CONNECTING") {
                return { kind: "WsConnecting", context: { ...state.context } };
            }
            return state;
        }

        case "WsConnecting": {
            // WS가 붙었더라도, SYS_ATTACH_OK(EV_ATTACHED_OK)를 받아야 진짜 Attached
            if (event.type === "EV_ATTACHED_OK") {
                return { kind: "Attached", context: { ...state.context } };
            }
            // 단순히 소켓 열림 이벤트는 상태 유지 (Connecting... UI 유지)
            // 혹은 "Handshaking" 같은 중간 상태를 둘 수도 있으나, 여기선 WsConnecting 유지
            if (event.type === "EV_WS_CONNECTED") {
                return state;
            }
            return state;
        }

        case "Attached": {
            // Signaling 준비 완료 -> SDP Offer/Answer 교환 시작
            if (event.type === "EV_PC_CONNECTING") {
                return { kind: "PcConnecting", context: { ...state.context } };
            }
            // 바로 Connected 될 수도 있음 (IceRestart 등)
            if (event.type === "EV_PC_CONNECTED") {
                return { kind: "Connected", context: { ...state.context } };
            }
            // Answer/ICE 수신은 상태 변화 없이 처리(Side Effect로 처리됨)
            if (event.type === "EV_GOT_ANSWER" || event.type === "EV_GOT_ICE") {
                return state;
            }
            return state;
        }

        case "PcConnecting": {
            if (event.type === "EV_PC_CONNECTED") {
                return { kind: "Connected", context: { ...state.context } };
            }
            // Negotiation 중에도 ICE/Answer 는 계속 옴
            if (event.type === "EV_GOT_ANSWER" || event.type === "EV_GOT_ICE") {
                return state;
            }
            return state;
        }

        case "Connected": {
            // 재협상(Renegotiation) 필요 시 다시 PcConnecting 갈 수 있음
            if (event.type === "EV_PC_CONNECTING") {
                return { kind: "PcConnecting", context: { ...state.context } };
            }
            // PING은 상태 변화 없음
            if (event.type === "EV_PING") {
                return state;
            }
            return state;
        }

        case "Reconnecting": {
            // 재연결 성공 시 Attached로 복귀 (혹은 바로 Connected)
            if (event.type === "EV_ATTACHED_OK") {
                return { kind: "Attached", context: { ...state.context, lastError: null } };
            }
            return state;
        }

        default:
            return state;
    }
}