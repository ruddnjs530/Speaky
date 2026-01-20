import type { ApiErrorResponse, StartOrJoinResponse } from "./sessionApi.types";

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

/**
 * 실제 엔드포인트는 팀 백엔드 스펙에 맞춰 교체하세요.
 * Day1에서는 "응답 타입 정리 + 상태머신 연결"이 목적입니다.
 */
export const sessionApi = {
    async startLive(channelId: string): Promise<StartOrJoinResponse> {
        const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}/live/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) throw await parseError(res);
        return (await res.json()) as StartOrJoinResponse;
    },

    async joinLive(channelId: string): Promise<StartOrJoinResponse> {
        const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}/live/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) throw await parseError(res);
        return (await res.json()) as StartOrJoinResponse;
    },
};
