import Card from "../../../shared/ui/Card";
import "./VoiceSelectPanel.css";
import type { Voice } from "../api/voiceApi";

import voice1 from "./assets/voice-ai-1-BJW.webp";
import voice2 from "./assets/voice-ai-2-CSW.jpg";
import voice3 from "./assets/voice-ai-3-IU.webp";
import voice4 from "./assets/voice-ai-4-ANYA.webp";

// 간단한 아바타 매핑 (ID 기반)
const AVATARS = [voice1, voice2, voice3, voice4];

function getAvatar(id: number) {
    // 1-based index to 0-based array
    const index = (id - 1) % AVATARS.length;
    return AVATARS[index] || voice1;
}

interface Props {
    voices: Voice[];
    voiceId: number;
    onSelect: (voiceId: number) => void;
}

export default function VoiceSelectPanel({ voices, voiceId, onSelect }: Props) {
    // 선택된 보이스 찾기 (없으면 첫번째)
    const selected = voices.find((v) => v.id === voiceId) ?? voices[0];

    // voices가 로딩 중이거나 비어있을 때 처리
    if (!selected) {
        return (
            <Card className="voicePanel" title="③ AI 보이스 선택">
                <div className="p-3">보이스 목록을 불러오는 중...</div>
            </Card>
        );
    }

    const selectedAvatar = getAvatar(selected.id);

    return (
        <Card className="voicePanel" title="③ AI 보이스 선택">
            {/* 상단: 선택된 카드 요약 */}
            <div className="voicePanel__selectedRow">
                <div className="voicePanel__label">선택됨</div>
                <div className="voicePanel__selectedBox">
                    <img className="voicePanel__avatarLg" src={selectedAvatar} alt="" />
                    <div className="voicePanel__selectedText">
                        <div className="voicePanel__name">{selected.name}</div>
                        <span
                            className={[
                                "voicePanel__badge",
                                selected.status === "READY" ? "is-ready" : "",
                                selected.status === "LOADING" ? "is-loading" : "",
                                selected.status === "ERROR" ? "is-unknown" : "", // ERROR -> red
                            ]
                                .filter(Boolean)
                                .join(" ")}
                        >
                            {selected.status}
                        </span>
                    </div>
                </div>
            </div>

            {/* 그리드: 동적 리스트 */}
            <div className="voicePanel__grid2x2" role="list">
                {voices.map((v) => {
                    const active = v.id === voiceId;
                    const avatar = getAvatar(v.id);
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
                                v.status === "ERROR" ? "is-unknown" : "",
                            ]
                                .filter(Boolean)
                                .join(" ")}
                            onClick={() => onSelect(v.id)}
                            aria-pressed={active}
                        >
                            <img className="voiceCard__avatar" src={avatar} alt="" />
                            <div className="voiceCard__meta">
                                <div className="voiceCard__title">{v.name}</div>
                                <span className="voicePanel__badge">{v.status}</span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </Card>
    );
}
