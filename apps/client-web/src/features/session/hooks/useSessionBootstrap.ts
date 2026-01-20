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
        if (
            typeof e.code === "string" &&
            (e.code === "UNAUTHORIZED" ||
                e.code === "INVALID_CLIENT_ID" ||
                e.code === "INVALID_STATE" ||
                e.code === "SESSION_NOT_ACTIVE" ||
                e.code === "DUPLICATE_HOST" ||
                e.code === "MEDIA_UNAVAILABLE" ||
                e.code === "RATE_LIMITED" ||
                e.code === "REST_ERROR" ||
                e.code === "UNKNOWN")
        ) {
            code = e.code;
        }

        if (typeof e.message === "string") {
            message = e.message;
        }
    }

    return { code, message };
}

/**
 * ✅ 추가: REST bootstrap/join 응답 필수 필드 검증
 * - 백엔드 스펙 논의(필드명 변경 등)와 무관하게, "없으면 진행 불가"인 것만 체크
 * - 누락 시 BOOTSTRAP_SUCCESS를 막고, BOOTSTRAP_FAIL로 보내기 위한 throw
 */
function assertBootstrapResponse(res: unknown): asserts res is {
    channelId: string;
    sessionId: string;
    role: Role;
    wsUrl: string;
    token: string;
} {
    if (!isRecord(res)) {
        throw { code: "REST_ERROR", message: "Invalid bootstrap response (not an object)" };
    }

    // 필수 필드 존재성(타입까지 엄격히)
    if (typeof res.channelId !== "string" || res.channelId.length === 0) {
        throw { code: "REST_ERROR", message: "Invalid bootstrap response (missing channelId)" };
    }
    if (typeof res.sessionId !== "string" || res.sessionId.length === 0) {
        throw { code: "REST_ERROR", message: "Invalid bootstrap response (missing sessionId)" };
    }
    if (typeof res.wsUrl !== "string" || res.wsUrl.length === 0) {
        throw { code: "REST_ERROR", message: "Invalid bootstrap response (missing wsUrl)" };
    }
    if (typeof res.token !== "string" || res.token.length === 0) {
        throw { code: "REST_ERROR", message: "Invalid bootstrap response (missing token)" };
    }
    // role은 현재 타입이 Role로 되어 있어서, 여기서는 존재성만 확인(필요 시 enum 파서로 강화 가능)
    if (typeof res.role !== "string") {
        throw { code: "REST_ERROR", message: "Invalid bootstrap response (missing role)" };
    }
}

export function useSessionBootstrap() {
    const dispatch = useAppDispatch();
    const state = useAppStateValue();

    // ✅ 중복 호출 방지 가드
    // - Idle이 아닐 때(이미 진행/완료 상태) bootstrap을 다시 시작하지 않음
    // - 단, Error 상태에서는 재시도 허용(원하면 유지)
    function canStartBootstrap(kind: string) {
        return kind === "Idle" || kind === "Error";
    }

    async function start(channelId: string) {
        if (!canStartBootstrap(state.kind)) return;

        dispatch({ type: "BOOTSTRAP_START" });

        try {
            const res = await sessionApi.startLive(channelId);

            // ✅ 추가: dispatch 전에 응답 검증
            assertBootstrapResponse(res);

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
        if (!canStartBootstrap(state.kind)) return;

        dispatch({ type: "BOOTSTRAP_START" });

        try {
            const res = await sessionApi.joinLive(channelId);

            // ✅ 추가: dispatch 전에 응답 검증
            assertBootstrapResponse(res);

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
