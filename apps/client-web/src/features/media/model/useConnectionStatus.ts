export type ConnectionStatus =
    | 'idle'
    | 'connecting'
    | 'connected'
    | 'disconnected'
    | 'failed'
    // 기존 훅에서 다른 문자열이 올 수 있으니, 필요 시 확장
    | string;

export function getStatusMessage(status: ConnectionStatus) {
    switch (status) {
        case 'connecting':
            return '연결 중입니다…';
        case 'disconnected':
            return '연결이 끊겼습니다. 재연결 시도 중…';
        case 'failed':
            return '재연결에 실패했습니다.';
        default:
            return null;
    }
}
