import type { ReactNode } from 'react';
type Props = {
    open: boolean;
    title: string;
    children: ReactNode;
    primaryLabel?: string;
    onPrimary?: () => void;
    secondaryLabel?: string;
    onSecondary?: () => void;
};
export default function Modal({
    open,
    title,
    children,
    primaryLabel = '확인',
    onPrimary,
    secondaryLabel,
    onSecondary,
}: Props) {
    if (!open) return null;
    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'grid',
                placeItems: 'center',
                zIndex: 9999,
            }}
        >
            <div style={{ width: 360, background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 12px', fontWeight: 700, fontSize: '1.125rem' }}>{title}</h3>

                <div style={{ color: '#444', marginBottom: 24, lineHeight: 1.5 }}>
                    {children}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    {secondaryLabel && onSecondary && (
                        <button
                            onClick={onSecondary}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '6px',
                                border: '1px solid #ddd',
                                background: '#fff',
                                cursor: 'pointer'
                            }}
                        >
                            {secondaryLabel}
                        </button>
                    )}
                    {onPrimary && (
                        <button
                            onClick={onPrimary}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '6px',
                                border: 'none',
                                background: '#3b82f6',
                                color: '#fff',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            {primaryLabel}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}