import Card from "./Card";
import Button from "./Button";
import "./HealthPanel.css";

export type HealthState = "ok" | "warn" | "fail" | "unknown";

export interface HealthItem {
    key: string;
    label: string;
    state: HealthState;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export interface HealthPanelProps {
    title?: string;
    items: HealthItem[];
}

function marker(state: HealthState): string {
    switch (state) {
        case "ok":
            return "OK";
        case "warn":
            return "WARN";
        case "fail":
            return "FAIL";
        default:
            return "...";
    }
}

export default function HealthPanel({ title = "상태 점검", items }: HealthPanelProps) {
    return (
        <Card title={title} subtitle="권한/연결 단계별 상태를 확인합니다.">
            <div className="health-panel">
                {items.map((it) => (
                    <div key={it.key} className="health-item">
                        <div
                            className={`health-item__marker ${
                                it.state === "unknown"
                                    ? "health-item__marker--unknown"
                                    : ""
                            }`}
                        >
                            {marker(it.state)}
                        </div>

                        <div className="health-item__body">
                            <div className="health-item__label">{it.label}</div>
                            {it.description && (
                                <div className="health-item__desc">
                                    {it.description}
                                </div>
                            )}
                        </div>

                        {it.action && (
                            <Button
                                variant="secondary"
                                fullWidth={false}
                                onClick={it.action.onClick}
                            >
                                {it.action.label}
                            </Button>
                        )}
                    </div>
                ))}
            </div>
        </Card>
    );
}
