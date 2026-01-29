import "./Badge.css";

export type BadgeValue = "ok" | "warn" | "fail" | "unknown";

interface Props {
    label: string;
    value: BadgeValue | string | number;
}

export default function Badge({ label, value }: Props) {
    const statusClass = ["ok", "warn", "fail", "unknown"].includes(String(value))
        ? `badge--${value}`
        : "badge--info"; // 일반 정보 표기용 스타일 (필요시 CSS 추가)

    return (
        <span className={["badge", statusClass].join(" ")}>
            {label}: {String(value).toUpperCase()}
        </span>
    );
}
