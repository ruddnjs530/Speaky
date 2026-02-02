import Card from "../../../shared/ui/Card";
import "./VoiceSelectPanel.css";
import type { Voice } from "../api/voiceApi";

import voice1 from "./assets/voice-ai-1-BJW.webp";
import voice2 from "./assets/voice-ai-2-CSW.jpg";
import voice3 from "./assets/voice-ai-3-IU.webp";
import voice4 from "./assets/voice-ai-4-ANYA.webp";

// 간단한 아바타 매핑 (서버 imageUrl 키값 -> 로컬 에셋)
const AVATAR_MAP: Record<string, string> = {
    "avatar_1": voice1,
    "avatar_2": voice2,
    "avatar_3": voice3,
    "avatar_4": voice4,
};

function getAvatar(voice: Voice) {
    // 1. 서버에서 내려준 키값으로 매핑 시도
    if (voice.imageUrl && AVATAR_MAP[voice.imageUrl]) {
        return AVATAR_MAP[voice.imageUrl];
    }
    // 2. Fallback: ID 기반 모듈러 연산 (기존 로직 유지)
    const values = Object.values(AVATAR_MAP);
    const index = (voice.id - 1) % values.length;
    return values[index] || voice1;
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

    const selectedAvatar = getAvatar(selected);

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
                    const avatar = getAvatar(v);
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
