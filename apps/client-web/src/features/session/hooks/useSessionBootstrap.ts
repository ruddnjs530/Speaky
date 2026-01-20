import { sessionApi } from "../api/sessionApi";
import { getOrCreateClientId } from "../utils/clientId";
import type { Role } from "../state/appState.types";
import { useAppState } from "../state/useAppState.ts";

function toRole(input: Role): Role {
    // 서버가 HOST/GUEST로 내려준다고 가정
    return input;
}

export function useSessionBootstrap() {
    const { dispatch } = useAppState();

    async function start(channelId: string) {
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
        } catch (e: any) {
            dispatch({
                type: "BOOTSTRAP_FAIL",
                error: {
                    code: (e?.code as any) ?? "REST_ERROR",
                    message: e?.message ? String(e.message) : "REST bootstrap failed",
                },
            });
        }
    }

    async function join(channelId: string) {
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
        } catch (e: any) {
            dispatch({
                type: "BOOTSTRAP_FAIL",
                error: {
                    code: (e?.code as any) ?? "REST_ERROR",
                    message: e?.message ? String(e.message) : "REST join failed",
                },
            });
        }
    }

    return { start, join };
}
