import type { ApiErrorResponse, StartOrJoinResponse, SessionResponse } from "./sessionApi.types";
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

    // 세션 생성 (대기방 만들기)
    async createSession(title: string):
        Promise<SessionResponse> {
        const res = await fetch('/api/v1/sessions', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
                title: title || "방송 제목 없음",
                voiceModelID: null
            }),
        });

        if (!res.ok) throw await parseError(res);
        return (await res.json()) as SessionResponse;
    },


    // 세션 시작 (라이브 시작)
    async startLive(sessionId: string): Promise<SessionResponse> {
        const res = await fetch(
            `/api/v1/sessions/${sessionId}/start`,
            {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({
                    mediaServerId: "default",
                    pipelineId: "default",
                }),
            }
        );

        if (!res.ok) throw await parseError(res);
        return (await res.json()) as SessionResponse;
    },

    // 세션 참여 (라이브 참여)
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

    // 방송 종료
    async endBroadcast(sessionId: string): Promise<SessionResponse> {
        const res = await fetch(
            `/api/v1/sessions/${sessionId}/end`,
            {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({
                    reason: "HOST_ENDED" // 종료 사유 전달
                }),
            }
        );
        if (!res.ok) throw await parseError(res);
        return (await res.json()) as SessionResponse;
    },
};

