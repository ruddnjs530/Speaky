import type { ConnectionStatus } from '../model/useConnectionStatus';
import { getStatusMessage } from '../model/useConnectionStatus';

type Props = {
    status: ConnectionStatus;
    onRetry?: () => void;
};

export default function ReconnectBanner({ status, onRetry }: Props) {
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
                <button type="button" onClick={onRetry}>
                    새로고침
                </button>
            )}
        </div>
    );
}
