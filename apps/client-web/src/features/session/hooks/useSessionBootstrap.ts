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
 * REST bootstrap/join 응답 필수 필드 검증
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
    if (typeof res.role !== "string") {
        throw { code: "REST_ERROR", message: "Invalid bootstrap response (missing role)" };
    }
}

export function useSessionBootstrap() {
    const dispatch = useAppDispatch();
    const state = useAppStateValue();

    function canStartBootstrap(kind: string) {
        return kind === "Idle" || kind === "Error";
    }

    async function startHost() {
        if (!canStartBootstrap(state.kind)) return;

        dispatch({ type: "EV_BOOTSTRAP_START" });

        try {
            // [v1 API 대응 수정] startHostLive 호출을 createSession으로 대체
            // 참고: startHostLive는 기존에 세션 생성+시작을 동시에 했을 가능성이 있습니다.
            // AppState 흐름상 'Create + Start'를 의미하겠지만, 현재는 createSession만 수행합니다.

            // 1. 세션 생성
            const session = await sessionApi.createSession("Default Title");

            // 2. HostPage 동작과 맞추기 위해 여기서 자동으로 startLive를 호출하지 않습니다.
            // 다만 이 훅(Bootstrap)의 기대값에 맞춰, 세션 응답을 StartOrJoinResponse 구조로 매핑합니다. 
            // 그래야 dispatch가 정상 작동합니다.

            const res = {
                channelId: session.channelId || `host-${session.hostUserId}`,
                sessionId: session.sessionId,
                role: "HOST" as Role,
                wsUrl: session.wsUrl || "",
                token: session.signalingToken || ""
            };

            assertBootstrapResponse(res);

            dispatch({
                type: "EV_BOOTSTRAPPED",
                payload: {
                    channelId: res.channelId,
                    sessionId: res.sessionId,
                    role: toRole(res.role),
                    wsUrl: res.wsUrl,
                    signalingToken: res.token,
                    clientId: getOrCreateClientId(), // A파트(공통) 제공
                },
            });
        } catch (e: unknown) {
            dispatch({
                type: "EV_BOOTSTRAP_FAIL",
                error: normalizeError(e, "REST bootstrap failed"),
            });
        }
    }

    async function start(channelId: string) {
        if (!canStartBootstrap(state.kind)) return;

        dispatch({ type: "EV_BOOTSTRAP_START" });

        try {
            const res = await sessionApi.startLive(channelId);
            assertBootstrapResponse(res);

            dispatch({
                type: "EV_BOOTSTRAPPED",
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
                type: "EV_BOOTSTRAP_FAIL",
                error: normalizeError(e, "REST bootstrap failed"),
            });
        }
    }

    async function join(channelId: string) {
        if (!canStartBootstrap(state.kind)) return;

        dispatch({ type: "EV_BOOTSTRAP_START" });

        try {
            const res = await sessionApi.joinLive(channelId);
            assertBootstrapResponse(res);

            dispatch({
                type: "EV_BOOTSTRAPPED",
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
                type: "EV_BOOTSTRAP_FAIL",
                error: normalizeError(e, "REST join failed"),
            });
        }
    }

    return { startHost, start, join };
}