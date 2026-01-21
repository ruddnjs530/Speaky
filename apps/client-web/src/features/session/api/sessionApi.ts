import type { ApiErrorResponse, StartOrJoinResponse } from "./sessionApi.types";
import { authHeaders } from "./authHeaders";

async function parseError(res: Response): Promise<{ code: string; message: string }> {
    try {
        const body = (await res.json()) as ApiErrorResponse;
        return {
            code: body.code ?? "REST_ERROR",
            message: body.message ?? `HTTP ${res.status}`,
        };
    } catch {
        return { code: "REST_ERROR", message: `HTTP ${res.status}` };
    }
}

export const sessionApi = {
    async startLive(channelId: string): Promise<StartOrJoinResponse> {
        const res = await fetch(
            `/api/channels/${encodeURIComponent(channelId)}/live/start`,
            {
                method: "POST",
                headers: authHeaders(),
            }
        );

        if (!res.ok) throw await parseError(res);
        return (await res.json()) as StartOrJoinResponse;
    },

    async joinLive(channelId: string): Promise<StartOrJoinResponse> {
        const res = await fetch(
            `/api/channels/${encodeURIComponent(channelId)}/live/join`,
            {
                method: "POST",
                headers: authHeaders(),
            }
        );

        if (!res.ok) throw await parseError(res);
        return (await res.json()) as StartOrJoinResponse;
    },

    /** ✅ 호스트 전용: channelId 없이 시작 */
    async startHostLive(): Promise<StartOrJoinResponse> {
        const res = await fetch(`/api/live/host/start`, {
            method: "POST",
            headers: authHeaders(),
        });

        if (!res.ok) throw await parseError(res);
        return (await res.json()) as StartOrJoinResponse;
    },
};
