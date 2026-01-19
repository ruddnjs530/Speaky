import Card from "../../../shared/ui/Card";
import "./VoiceSelectPanel.css";

interface Props {
    voiceId: string;
    onSelect: (voiceId: string) => void;
}

const VOICES = ["AI 보이스 1", "AI 보이스 2", "AI 보이스 3", "AI 보이스 4"];

export default function VoiceSelectPanel({ voiceId, onSelect }: Props) {
    return (
        // TODO: 선택된 보이스를 기준으로 음성 변환 엔진 상태(LOADING/READY)를 연동합니다.
        // TODO: 프리뷰/모델 연동은 다음 주
        <Card
            className="voicePanel"
            title="③ AI 보이스 선택"

        >
            <div className="voicePanel__grid">
                <div className="voicePanel__selected">
                    <div className="voicePanel__label">선택됨</div>
                    <div className="voicePanel__selectedBox">{voiceId}</div>
                </div>

                <div className="voicePanel__list">
                    {VOICES.map((v) => {
                        const active = v === voiceId;
                        return (
                            <button
                                key={v}
                                type="button"
                                className={["voicePanel__item", active ? "is-active" : ""]
                                    .filter(Boolean)
                                    .join(" ")}
                                onClick={() => onSelect(v)}
                                aria-pressed={active}
                            >
                                {v}
                            </button>
                        );
                    })}
                </div>
            </div>
        </Card>
    );
}
