
export function LoadingPanel({ text }: { text: string }) {
    return (
        <div style={{ padding: 16 }}>
            <h2>{text}</h2>
            <p>처리 중입니다…</p>
        </div>
    );
}
