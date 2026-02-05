/**
 * 전역 설정 상수
 */

// WebSocket 기본 URL (환경 변수 또는 기본값)
// WebSocket 기본 URL (환경 변수 필수)
if (!import.meta.env.VITE_WS_URL) {
    throw new Error('API Error: VITE_WS_URL environment variable is not defined.');
}
export const WS_URL_DEFAULT = import.meta.env.VITE_WS_URL;
