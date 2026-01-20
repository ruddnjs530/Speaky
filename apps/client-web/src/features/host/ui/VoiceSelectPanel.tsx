import Card from "../../../shared/ui/Card";
import "./VoiceSelectPanel.css";

import voice1 from "./assets/voice-ai-1-BJW.webp";
import voice2 from "./assets/voice-ai-2-CSW.jpg";
import voice3 from "./assets/voice-ai-3-IU.webp";
import voice4 from "./assets/voice-ai-4-ANYA.webp";

type VoiceStatus = "READY" | "LOADING" | "UNKNOWN";

interface VoiceMeta {
    id: string;       // onSelect에 전달할 값(지금은 label과 동일하게 사용)
    label: string;    // 화면 표시 텍스트
    avatar: string;   // 이미지
    status: VoiceStatus;
}

interface Props {
    voiceId: string;
    onSelect: (voiceId: string) => void;
}

// TODO: 다음 주 실제 모델 상태(엔진 LOADING/READY)와 연동 시 status만 동적으로 바꾸면 됩니다.
const VOICES: VoiceMeta[] = [
    { id: "AI 보이스 1", label: "AI 보이스 1", avatar: voice1, status: "READY" },
    { id: "AI 보이스 2", label: "AI 보이스 2", avatar: voice2, status: "READY" },
    { id: "AI 보이스 3", label: "AI 보이스 3", avatar: voice3, status: "LOADING" },
    { id: "AI 보이스 4", label: "AI 보이스 4", avatar: voice4, status: "UNKNOWN" },
];

function statusLabel(status: VoiceStatus) {
    switch (status) {
        case "READY":
            return "READY";
        case "LOADING":
            return "LOADING";
        default:
            return "UNKNOWN";
    }
}

export default function VoiceSelectPanel({ voiceId, onSelect }: Props) {
    const selected = VOICES.find((v) => v.id === voiceId) ?? VOICES[0];

    return (
        <Card className="voicePanel" title="③ AI 보이스 선택">
            {/* 상단: 선택된 카드 요약 */}
            <div className="voicePanel__selectedRow">
                <div className="voicePanel__label">선택됨</div>
                <div className="voicePanel__selectedBox">
                    <img className="voicePanel__avatarLg" src={selected.avatar} alt="" />
                    <div className="voicePanel__selectedText">
                        <div className="voicePanel__name">{selected.label}</div>
                        <span
                            className={[
                                "voicePanel__badge",
                                selected.status === "READY" ? "is-ready" : "",
                                selected.status === "LOADING" ? "is-loading" : "",
                                selected.status === "UNKNOWN" ? "is-unknown" : "",
                            ]
                                .filter(Boolean)
                                .join(" ")}
                        >
              {statusLabel(selected.status)}
            </span>
                    </div>
                </div>
            </div>

            {/* 2x2 카드 그리드 */}
            <div className="voicePanel__grid2x2" role="list">
                {VOICES.map((v) => {
                    const active = v.id === voiceId;
                    return (
                        <button
                            key={v.id}
                            type="button"
                            role="listitem"
                            className={[
                                "voiceCard",
                                active ? "is-active" : "",
                                v.status === "READY" ? "is-ready" : "",
                                v.status === "LOADING" ? "is-loading" : "",
                                v.status === "UNKNOWN" ? "is-unknown" : "",
                            ]
                                .filter(Boolean)
                                .join(" ")}
                            onClick={() => onSelect(v.id)}
                            aria-pressed={active}
                        >
                            <img className="voiceCard__avatar" src={v.avatar} alt="" />
                            <div className="voiceCard__meta">
                                <div className="voiceCard__title">{v.label}</div>
                                <span className="voicePanel__badge">{statusLabel(v.status)}</span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </Card>
    );
}
