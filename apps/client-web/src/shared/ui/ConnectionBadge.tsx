type Props = {
  status: 'idle' | 'connecting' | 'connected' | 'error';
};

export default function ConnectionBadge({ status }: Props) {
  const text =
    status === 'idle'
      ? '대기'
      : status === 'connecting'
      ? '연결 중'
      : status === 'connected'
      ? '연결됨'
      : '오류';

  return (
    <span
      style={{
        padding: '6px 10px',
        borderRadius: 999,
        border: '1px solid #ddd',
        fontSize: 12,
      }}
    >
      {text}
    </span>
  );
}
