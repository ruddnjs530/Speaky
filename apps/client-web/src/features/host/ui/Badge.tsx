import "./Badge.css";

export type BadgeValue = "ok" | "warn" | "fail" | "unknown";

interface Props {
    label: string;
    value: BadgeValue;
}

export default function Badge({ label, value }: Props) {
    return (
        <span className={["badge", `badge--${value}`].join(" ")}>
      {label}: {value.toUpperCase()}
    </span>
    );
}
