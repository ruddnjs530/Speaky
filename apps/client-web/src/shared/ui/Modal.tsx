import type { ReactNode } from 'react';
import './Modal.css';
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
        <div className="modal-overlay">
            <div className="modal-container">
                <h3 className="modal-title">{title}</h3>
                <div className="modal-content">
                    {children}
                </div>

                <div className="modal-actions">
                    {secondaryLabel && onSecondary && (
                        <button
                            className="modal-button secondary"
                            onClick={onSecondary}
                        >
                            {secondaryLabel}
                        </button>
                    )}
                    {onPrimary && (
                        <button
                            className="modal-button primary"
                            onClick={onPrimary}
                        >
                            {primaryLabel}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}