import type { AppError, Role } from "./appState.types";

export type BootstrapPayload = {
    channelId: string;
    sessionId: string;
    role: Role;
    wsUrl: string;
    signalingToken: string;
    clientId: string;
};

export type AppEvent =
// REST bootstrap (Day1)
    | { type: "BOOTSTRAP_START" }
    | { type: "BOOTSTRAP_SUCCESS"; payload: BootstrapPayload }
    | { type: "BOOTSTRAP_FAIL"; error: AppError }

    // WS lifecycle (Day2에서 실제 연결 붙일 예정)
    | { type: "WS_CONNECT_START" }
    | { type: "WS_CONNECTED" }
    | { type: "WS_ATTACH_SUCCESS" }

    // PC lifecycle (Day2)
    | { type: "PC_CONNECT_START" }
    | { type: "PC_CONNECTED" }

    // 공통 에러/복구
    | { type: "SYS_ERROR"; error: AppError }
    | { type: "RETRY" }
    | { type: "RESET" };
