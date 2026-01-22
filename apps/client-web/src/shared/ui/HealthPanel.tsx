type Props = {
  title?: string;
  items: { label: string; value: string }[];
};

export default function HealthPanel({ title = '연결 상태', items }: Props) {
  return (
    <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'grid', gap: 6 }}>
        {items.map((it) => (
          <div key={it.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#666' }}>{it.label}</span>
            <span>{it.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
