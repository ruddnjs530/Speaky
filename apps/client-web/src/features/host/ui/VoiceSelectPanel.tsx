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
    // 상태별 한글 텍스트 매핑
    const STATUS_LABEL: Record<string, string> = {
        READY: "준비",
        LOADING: "로딩 중",
        ERROR: "에러",
    };

    // 선택된 보이스 찾기 (없으면 첫번째)
    const selected = voices.find((v) => v.id === voiceId) ?? voices[0];

    // voices가 로딩 중이거나 비어있을 때 처리
    if (!selected) {
        return (
            <section className="voicePanel h-full rounded-xl border bg-white shadow-sm flex flex-col p-6 font-sans">
                <header className="flex flex-col space-y-1.5 pb-6 flex-none">
                    <h3 className="font-semibold leading-none tracking-tight">③ AI 보이스 선택</h3>
                </header>
                <div className="flex-1">보이스 목록을 불러오는 중...</div>
            </section>
        );
    }

    const selectedAvatar = getAvatar(selected);

    return (
        <section className="voicePanel h-full rounded-xl border bg-white shadow-sm flex flex-col font-sans">
            <header className="flex flex-col space-y-1.5 p-6 pb-0 flex-none">
                <h3 className="font-semibold leading-none tracking-tight">③ AI 보이스 선택</h3>
            </header>

            <div className="p-6 pt-6 flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* 상단: 선택된 카드 요약 */}
                <div className="voicePanel__selectedRow flex-none">
                    <div className="voicePanel__selectedBox">
                        <img className="voicePanel__avatarLg" src={selectedAvatar} alt="" />
                        <div className="voicePanel__selectedText">
                            <div className="voicePanel__name">{selected.name}</div>
                            <span
                                className={[
                                    "voicePanel__badge",
                                    // 선택된 상태이므로 READY -> is-selected 스타일 적용
                                    selected.status === "READY" ? "is-selected" : "",
                                    selected.status === "LOADING" ? "is-loading" : "",
                                    selected.status === "ERROR" ? "is-unknown" : "", // ERROR -> red
                                ]
                                    .filter(Boolean)
                                    .join(" ")}
                            >
                                {selected.status === "READY"
                                    ? "선택됨"
                                    : STATUS_LABEL[selected.status] || selected.status}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 그리드: 동적 리스트 */}
                <div className="voicePanel__grid2x2 flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar" role="list">
                    {voices.map((v) => {
                        const active = v.id === voiceId;
                        const avatar = getAvatar(v);

                        // 선택된 항목이이고 READY 상태면 '선택됨' 표시
                        const isSelectedReady = active && v.status === "READY";

                        // 텍스트 결정: 선택됨 or 한글 상태 or 원본 상태
                        const statusText = isSelectedReady
                            ? "선택됨"
                            : STATUS_LABEL[v.status] || v.status;

                        // 클래스 결정
                        const statusClass = isSelectedReady
                            ? "is-selected"
                            : v.status === "READY" ? "is-ready"
                                : v.status === "LOADING" ? "is-loading"
                                    : "is-unknown";

                        return (
                            <button
                                key={v.id}
                                type="button"
                                role="listitem"
                                className={[
                                    "voiceCard",
                                    active ? "is-active" : "",
                                    // 카드 자체 상태 클래스 추가가 아니라 배지에 직접 적용하므로 여기선 배지 클래스만 신경씀
                                    // 하지만 기존 CSS 구조상 voiceCard 상태 클래스가 배지 색상을 덮어쓸 수 있음.
                                    // voiceCard.is-ready .voicePanel__badge 같은 선택자 확인 필요.
                                    // 위 CSS 파일에서 .voiceCard.is-ready .voicePanel__badge 등이 있음.
                                    // 따라서 active 상태일 때의 특수 처리가 필요함.
                                    active ? "is-selected-card" : "", // 임의 클래스 추가
                                    !active && v.status === "READY" ? "is-ready" : "",
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
                                    <span className={`voicePanel__badge ${statusClass}`}>{statusText}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
