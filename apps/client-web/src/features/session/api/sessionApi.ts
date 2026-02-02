import type { ApiErrorResponse, StartOrJoinResponse, SessionResponse } from "./sessionApi.types";
import { apiFetch } from "../../../shared/lib/apiFetch";
import { getAccessToken, getUserIdFromToken } from "../../../shared/lib/authToken";


import { WS_URL_DEFAULT } from "../../../shared/config";

const WS_URL_FALLBACK = WS_URL_DEFAULT;

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

// 채널 상태 응답 (백엔드 ChannelStateResponse)
type ChannelStateResponse = {
    hostLoginId: string;
    activeSessionId: string | null;
};

export const sessionApi = {

    // 1. 세션 생성 (대기방 만들기)
    async createSession(title: string): Promise<SessionResponse> {
        const userId = getUserIdFromToken();
        if (!userId) throw new Error("로그인이 필요합니다.");

        const res = await apiFetch('/api/v1/sessions', {
            method: 'POST',
            body: JSON.stringify({
                hostUserId: userId,
                title: title || "방송 제목 없음",
                voiceModelID: null
            }),
        });

        if (!res.ok) throw await parseError(res);
        return (await res.json()) as SessionResponse;
    },

    // 세션 시작 (파라미터화)
    async startLive(
        sessionId: string,
        mediaServerId: string = "default",
        pipelineId: string = "default"
    ): Promise<SessionResponse> {
        const res = await apiFetch(
            `/api/v1/sessions/${sessionId}/start`,
            {
                method: "POST",
                body: JSON.stringify({
                    mediaServerId,
                    pipelineId,
                }),
            }
        );

        if (!res.ok) throw await parseError(res);
        return (await res.json()) as SessionResponse;
    },

    // 3. 세션 참여 (API 명세 준수: GET state -> session info)
    async joinLive(channelId: string): Promise<StartOrJoinResponse> {
        // (A) 채널 상태 조회
        const stateRes = await apiFetch(`/api/v1/channels/${encodeURIComponent(channelId)}/state`, { method: "GET" });
        if (!stateRes.ok) throw await parseError(stateRes);
        const state = (await stateRes.json()) as ChannelStateResponse;
        if (!state.activeSessionId) {
            throw { code: "SESSION_NOT_ACTIVE", message: "방송 중이 아닙니다." };
        }
        const sessionId = state.activeSessionId;
        // (B) 세션 상세 정보 조회 (wsUrl, token 획득 목적)
        const sessionRes = await apiFetch(`/api/v1/sessions/${sessionId}`, { method: 'GET' });
        if (!sessionRes.ok) throw await parseError(sessionRes);
        const session = (await sessionRes.json()) as SessionResponse;
        // 로그인된 사용자 토큰 (백엔드 signalingToken이 없으면 이걸 fallback으로 사용)
        const userToken = getAccessToken();
        /*
         * 만약 비로그인 사용자도 시청 가능하다면 userToken 체크는 제거하거나,
         * 백엔드에서 주는 session.signalingToken을 전적으로 신뢰해야 합니다.
         */
        if (!session.signalingToken && !userToken) {
            throw { code: "UNAUTHORIZED", message: "로그인 후 이용해주세요." };
        }
        return {
            channelId: state.hostLoginId || channelId, // hostLoginId를 우선
            sessionId: sessionId,
            role: "GUEST",
            wsUrl: session.wsUrl || WS_URL_FALLBACK,
            token: session.signalingToken || userToken || ""
        };
    },

    // 4. 방송 종료 (파라미터화)
    async endBroadcast(
        sessionId: string,
        reason: string = "HOST_ENDED"
    ): Promise<SessionResponse> {
        const res = await apiFetch(
            `/api/v1/sessions/${sessionId}/end`,
            {
                method: "POST",
                body: JSON.stringify({
                    reason
                }),
            }
        );
        if (!res.ok) throw await parseError(res);
        return (await res.json()) as SessionResponse;
    },
};