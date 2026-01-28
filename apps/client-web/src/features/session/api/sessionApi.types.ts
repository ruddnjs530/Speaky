import type { Role } from "../state/appState.types";

export type StartOrJoinResponse = {
    channelId: string;
    sessionId: string;
    role: Role;

    wsUrl: string;     // wss://{sc-domain}/ws/signaling
    token: string;     // signaling token
};

// 서버 에러 바디가 정해져 있으면 여기에 맞추세요
export type ApiErrorResponse = {
    code?: string;
    message?: string;
};

export type SessionResponse = {
    sessionId: string;
    hostUserId: number;
    voiceModelId: number | null;
    title: string;
    status: "STARTING" | "LIVE" | "ENDED" | "FAILED"; // Enum 대응
    startedAt?: string;
    endedAt?: string;
    mediaServerId?: string;
    pipelineId?: string;
    createdAt: string;

    // 🚨 중요: 현재 백엔드 응답에는 연결 정보(token, wsUrl)가 없습니다.
    // 따라서 HostPage에서 이 정보를 별도로 구성해야 합니다.
};
