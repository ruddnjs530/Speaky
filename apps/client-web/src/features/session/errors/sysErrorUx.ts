import type { AppError, SysErrorCode } from "../state/appState.types";

export type SysErrorActionType = "retry" | "reset" | "login" | "exit";
export type SysErrorActionKind = "primary" | "secondary" | "danger";
export type SysErrorLevel = "info" | "warn" | "error" | "fatal";

export interface SysErrorUxAction {
    type: SysErrorActionType;
    label: string;
    kind?: SysErrorActionKind;
}

export interface SysErrorUxSpec {
    code: SysErrorCode;
    level: SysErrorLevel;
    title: string;
    message: string;
    actions: SysErrorUxAction[];
}

/**
 * SYS_ERROR.code(AppError.code)를 사용자 메시지/액션으로 변환합니다.
 * - 여기서는 "무엇을 보여줄지"만 결정합니다.
 * - 실제로 action을 눌렀을 때 dispatch/navigate 하는 건 UI 레이어(패널/다이얼로그)에서 처리합니다.
 */
export function getSysErrorUx(err: AppError): SysErrorUxSpec {
    switch (err.code) {
        case "UNAUTHORIZED":
            return {
                code: err.code,
                level: "fatal",
                title: "로그인이 필요합니다.",
                message: "세션을 계속하려면 다시 로그인해 주세요.",
                actions: [
                    { type: "login", label: "로그인", kind: "primary" },
                    { type: "exit", label: "나가기", kind: "secondary" },
                ],
            };

        case "INVALID_CLIENT_ID":
            return {
                code: err.code,
                level: "error",
                title: "클라이언트 식별에 실패했습니다.",
                message: "초기화 후 다시 시도해 주세요.",
                actions: [
                    { type: "reset", label: "초기화", kind: "primary" },
                    { type: "exit", label: "나가기", kind: "secondary" },
                ],
            };

        case "INVALID_STATE":
            return {
                code: err.code,
                level: "error",
                title: "세션 상태가 올바르지 않습니다.",
                message: "초기화 후 다시 시도해 주세요.",
                actions: [
                    { type: "reset", label: "초기화", kind: "primary" },
                    { type: "retry", label: "재시도", kind: "secondary" },
                ],
            };

        case "SESSION_NOT_ACTIVE":
            return {
                code: err.code,
                level: "error",
                title: "세션이 활성 상태가 아닙니다.",
                message: "방송이 종료되었거나 아직 시작되지 않았을 수 있습니다.",
                actions: [{ type: "exit", label: "나가기", kind: "primary" }],
            };

        case "DUPLICATE_HOST":
            return {
                code: err.code,
                level: "fatal",
                title: "이미 호스트가 접속 중입니다.",
                message: "중복 접속은 허용되지 않습니다.",
                actions: [{ type: "exit", label: "나가기", kind: "primary" }],
            };

        case "MEDIA_UNAVAILABLE":
            return {
                code: err.code,
                level: "error",
                title: "미디어를 사용할 수 없습니다.",
                message: "권한/디바이스 상태를 확인한 뒤 다시 시도해 주세요.",
                actions: [
                    { type: "retry", label: "재시도", kind: "primary" },
                    { type: "exit", label: "나가기", kind: "secondary" },
                ],
            };

        case "RATE_LIMITED":
            return {
                code: err.code,
                level: "warn",
                title: "요청이 너무 많습니다.",
                message: "잠시 후 다시 시도해 주세요.",
                actions: [{ type: "retry", label: "재시도", kind: "primary" }],
            };

        case "REST_ERROR":
            return {
                code: err.code,
                level: "error",
                title: "서버 요청에 실패했습니다.",
                message: "네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
                actions: [
                    { type: "retry", label: "재시도", kind: "primary" },
                    { type: "exit", label: "나가기", kind: "secondary" },
                ],
            };

        case "UNKNOWN":
        default:
            return {
                code: err.code,
                level: "error",
                title: "알 수 없는 오류가 발생했습니다.",
                message: err.message || "잠시 후 다시 시도해 주세요.",
                actions: [
                    { type: "reset", label: "초기화", kind: "primary" },
                    { type: "exit", label: "나가기", kind: "secondary" },
                ],
            };
    }
}
