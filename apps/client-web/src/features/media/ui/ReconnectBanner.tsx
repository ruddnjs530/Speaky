import type { ConnectionStatus } from '../model/useConnectionStatus';
import { getStatusMessage } from '../model/useConnectionStatus';

type Props = {
    status: ConnectionStatus;

    /** 권장: WebRTC/WS 재연결(REST join + connect 재호출) */
    onRetry?: () => void;

    /** 최후 수단: 페이지 새로고침 */
    onReload?: () => void;
};

export default function ReconnectBanner({ status, onRetry, onReload }: Props) {
    const message = getStatusMessage(status);
    if (!message) return null;

    const isFailed = status === 'failed';

    return (
        <div
            style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: isFailed ? '#f8d7da' : '#fff3cd',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
            }}
        >
            <span>{message}</span>

            {isFailed && (
                <div style={{ display: 'flex', gap: 8 }}>
                    {onRetry && (
                        <button type="button" onClick={onRetry}>
                            다시 시도
                        </button>
                    )}
                    {onReload && (
                        <button type="button" onClick={onReload}>
                            새로고침
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
