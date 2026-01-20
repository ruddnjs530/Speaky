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
