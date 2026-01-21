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

// ...생략 (기존 import/유틸 그대로)

export function useSessionBootstrap() {
    const dispatch = useAppDispatch();
    const state = useAppStateValue();

    function canStartBootstrap(kind: string) {
        return kind === "Idle" || kind === "Error";
    }

    /** ✅ 신규: 호스트는 channelId 없이 시작 (서버가 토큰으로 채널 결정) */
    async function startHost() {
        if (!canStartBootstrap(state.kind)) return;

        dispatch({ type: "BOOTSTRAP_START" });

        try {
            // ✅ 여기 API가 필요합니다: channelId 없이 host start
            // 예: POST /api/live/host/start 같은 엔드포인트
            const res = await sessionApi.startHostLive();

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

    async function start(channelId: string) {
        if (!canStartBootstrap(state.kind)) return;

        dispatch({ type: "BOOTSTRAP_START" });

        try {
            const res = await sessionApi.startLive(channelId);
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

    return { startHost, start, join };
}

