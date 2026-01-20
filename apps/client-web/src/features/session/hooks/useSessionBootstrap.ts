import { sessionApi } from "../api/sessionApi";
import { getOrCreateClientId } from "../utils/clientId";
import type { Role } from "../state/appState.types";
import { useAppDispatch, useAppStateValue } from "../state/useAppState";
import type { SysErrorCode, AppError } from "../state/appState.types";

function toRole(input: Role): Role {
    return input;
}

function isRecord(x: unknown): x is Record<string, unknown> {
    return typeof x === "object" && x !== null;
}

function normalizeError(e: unknown, fallbackMessage: string): AppError {
    let code: SysErrorCode = "REST_ERROR";
    let message = fallbackMessage;

    if (isRecord(e)) {
        if (typeof e.code === "string" && (
            e.code === "UNAUTHORIZED" ||
            e.code === "INVALID_CLIENT_ID" ||
            e.code === "INVALID_STATE" ||
            e.code === "SESSION_NOT_ACTIVE" ||
            e.code === "DUPLICATE_HOST" ||
            e.code === "MEDIA_UNAVAILABLE" ||
            e.code === "RATE_LIMITED" ||
            e.code === "REST_ERROR" ||
            e.code === "UNKNOWN"
        )) {
            code = e.code;
        }

        if (typeof e.message === "string") {
            message = e.message;
        }
    }

    return { code, message };
}

export function useSessionBootstrap() {
    const dispatch = useAppDispatch();
    const state = useAppStateValue();

    // ✅ 중복 호출 방지 가드
    // - Idle이 아닐 때(이미 진행/완료 상태) bootstrap을 다시 시작하지 않음
    // - 단, Error 상태에서는 재시도 허용(원하면 유지)
    const isBusy = state.kind !== "Idle" && state.kind !== "Error";

    async function start(channelId: string) {
        if (isBusy) return;

        dispatch({ type: "BOOTSTRAP_START" });

        try {
            const res = await sessionApi.startLive(channelId);
            dispatch({
                type: "BOOTSTRAP_SUCCESS",
                payload: {
                    channelId: res.channelId,
                    sessionId: res.sessionId,
                    role: toRole(res.role),
                    wsUrl: res.wsUrl,
                    signalingToken: res.token,
                    clientId: getOrCreateClientId(),
                },
            });
        } catch (e: unknown) {
            dispatch({
                type: "BOOTSTRAP_FAIL",
                error: normalizeError(e, "REST bootstrap failed"),
            });
        }
    }

    async function join(channelId: string) {
        if (isBusy) return;

        dispatch({ type: "BOOTSTRAP_START" });

        try {
            const res = await sessionApi.joinLive(channelId);
            dispatch({
                type: "BOOTSTRAP_SUCCESS",
                payload: {
                    channelId: res.channelId,
                    sessionId: res.sessionId,
                    role: toRole(res.role),
                    wsUrl: res.wsUrl,
                    signalingToken: res.token,
                    clientId: getOrCreateClientId(),
                },
            });
        } catch (e: unknown) {
            dispatch({
                type: "BOOTSTRAP_FAIL",
                error: normalizeError(e, "REST join failed"),
            });
        }
    }

    return { start, join };
}
