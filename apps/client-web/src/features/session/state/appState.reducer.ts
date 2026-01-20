import type { AppState } from "./appState.types";
import type { AppEvent } from "./appState.events";

export function appStateReducer(state: AppState, event: AppEvent): AppState {
    // RESET은 어디서든 처리
    if (event.type === "RESET") {
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
    }

    // 에러는 어디서든 Error로 수렴(Day1 기준)
    if (event.type === "BOOTSTRAP_FAIL" || event.type === "SYS_ERROR") {
        return {
            kind: "Error",
            context: {
                ...state.context,
                lastError: event.error,
            },
        };
    }

    switch (state.kind) {
        case "Idle": {
            if (event.type === "BOOTSTRAP_SUCCESS") {
                return {
                    kind: "SessionReady",
                    context: {
                        ...state.context,
                        ...event.payload,
                        lastError: null,
                    },
                };
            }
            return state;
        }

        case "SessionReady": {
            if (event.type === "WS_CONNECT_START") {
                return { kind: "WsConnecting", context: { ...state.context } };
            }
            return state;
        }

        case "WsConnecting": {
            if (event.type === "WS_ATTACH_SUCCESS") {
                return { kind: "Attached", context: { ...state.context } };
            }
            return state;
        }

        case "Attached": {
            if (event.type === "PC_CONNECT_START") {
                return { kind: "PcConnecting", context: { ...state.context } };
            }
            return state;
        }

        case "PcConnecting": {
            if (event.type === "PC_CONNECTED") {
                return { kind: "Connected", context: { ...state.context } };
            }
            return state;
        }

        case "Error": {
            if (event.type === "RETRY") {
                // Day1 기준: 가장 단순하게 Idle로 돌리고 bootstrap부터 다시
                return { kind: "Idle", context: { ...state.context, lastError: null } };
            }
            return state;
        }

        // Day1에서는 아래 상태들은 아직 적극적으로 쓰지 않지만,
        // reducer가 안전하게 유지되도록 기본값 처리
        case "Connected":
        case "Reconnecting":
            return state;

        default: {
            const _exhaustive: never = state;
            return _exhaustive;
        }
    }
}
