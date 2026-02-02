/**
 * 전역 설정 상수
 */

// WebSocket 기본 URL (환경 변수 또는 기본값)
export const WS_URL_DEFAULT = import.meta.env.VITE_WS_URL || 'ws://localhost:8081/ws/signaling';
