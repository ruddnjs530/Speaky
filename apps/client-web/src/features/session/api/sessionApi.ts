import type { ApiErrorResponse, StartOrJoinResponse, SessionResponse } from "./sessionApi.types";
import { apiFetch } from "../../../shared/lib/apiFetch";
import { getAccessToken } from "../../../shared/lib/authToken";


const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';

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

// 채널 상태 응답 타입 (내부용)
type ChannelStateResponse = {
    hostLoginId: string;
    activeSessionId: string | null;
};

export const sessionApi = {

    // 세션 생성 (대기방 만들기)
    async createSession(title: string): Promise<SessionResponse> {
        const res = await apiFetch('/api/v1/sessions', {
            method: 'POST',
            body: JSON.stringify({
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

    // 세션 참여 (API 명세 준수: GET state -> session info)
    async joinLive(channelId: string): Promise<StartOrJoinResponse> {
        // 1. 채널 상태 조회 (백엔드 미구현 시 404 예상)
        const res = await apiFetch(
            `/api/v1/channels/${encodeURIComponent(channelId)}/state`,
            {
                method: "GET", // GET으로 변경
            }
        );

        if (!res.ok) throw await parseError(res);

        const data = (await res.json()) as { data: ChannelStateResponse }; // 공통 응답 래퍼 고려
        const state = data.data || data; // 구조에 따라 유연하게

        if (!state.activeSessionId) {
            throw { code: "SESSION_NOT_ACTIVE", message: "방송 중이 아닙니다." };
        }

        const token = getAccessToken();
        if (!token) {
            throw { code: "UNAUTHORIZED", message: "로그인 후 이용해주세요." };
        }

        // 2. 참여 정보 구성 (Viewer용 Response)
        // 백엔드에서 아직 wsUrl 등을 안주므로 Client 로직에서 구성해야 함
        return {
            channelId: state.hostLoginId,
            sessionId: state.activeSessionId,
            role: "GUEST",
            wsUrl: WS_URL,
            token: token
        };
    },

    // 방송 종료 (파라미터화)
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