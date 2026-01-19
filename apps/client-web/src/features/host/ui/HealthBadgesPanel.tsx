import Card from "../../../shared/ui/Card";
import Badge from "./Badge";
import type { HealthState } from "../hooks/usePrecheckModel.ts";
import "./HealthBadgesPanel.css";

interface Props {
    health: HealthState;
}

export default function HealthBadgesPanel({ health }: Props) {
    return (
        // TODO : 네트워크/AI는 다음 주 연동)
        <Card title="상태 표시">
            <div className="healthBadges">
                <Badge label="MIC" value={health.mic} />
                <Badge label="LEVEL" value={health.level} />
                <Badge label="NETWORK" value={health.network} />
                <Badge label="AI" value={health.ai} />
            </div>

            <p className="healthBadges__note">
                안내: MIC/LEVEL은 현재 더미 상태와 연결되어 있습니다. NETWORK/AI는 일단 UNKNOWN으로 표시합니다.
            </p>
        </Card>
    );
}
