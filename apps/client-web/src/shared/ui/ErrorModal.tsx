type Props = {
  open: boolean;
  title: string;
  description: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

export default function ErrorModal({
  open,
  title,
  description,
  primaryLabel,
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
        background: 'rgba(0,0,0,0.35)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 9999,
      }}
    >
      <div style={{ width: 360, background: '#fff', borderRadius: 14, padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
        <div style={{ color: '#444', marginBottom: 14, whiteSpace: 'pre-wrap' }}>
          {description}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {secondaryLabel && onSecondary && (
            <button onClick={onSecondary} style={{ padding: '8px 10px' }}>
              {secondaryLabel}
            </button>
          )}
          <button onClick={onPrimary} style={{ padding: '8px 10px' }}>
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
