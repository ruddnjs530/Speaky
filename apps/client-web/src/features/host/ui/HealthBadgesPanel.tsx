import Card from "../../../shared/ui/Card";
import Badge from "./Badge";
import type { HealthState } from "../hooks/usePrecheckModel.ts";
import "./HealthBadgesPanel.css";

interface Props {
    health?: HealthState;       // Optional로 변경하여 유연하게 사용
    viewers?: number | string; // 시청자 수
}

export default function HealthBadgesPanel({ health, viewers }: Props) {
    // health가 없을 경우 기본값 처리

    const safeHealth = health || {
        mic: "unknown",
        level: "unknown",
        network: "unknown",
        ai: "unknown",
    } as HealthState;

    return (
        <Card title="상태 표시">
            <div className="healthBadges">
                <Badge label="VIEWERS" value={viewers ?? "-"} />
                <Badge label="MIC" value={safeHealth.mic} />
                <Badge label="LEVEL" value={safeHealth.level} />
                <Badge label="NETWORK" value={safeHealth.network} />
                <Badge label="AI" value={safeHealth.ai} />
            </div>

        </Card>
    );
}
