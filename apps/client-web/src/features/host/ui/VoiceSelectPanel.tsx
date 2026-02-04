import type { Voice } from "../api/voiceApi";

import voice1 from "./assets/voice-ai-1-korone.webp";
import voice2 from "./assets/voice-ai-2-aru.webp";
import voice3 from "./assets/voice-ai-3-BJW.webp";
import voice4 from "./assets/voice-ai-4-ANYA.webp";
import voice5 from "./assets/voice-ai-5-trump.webp";
import voice6 from "./assets/voice-ai-6-criss.webp";
import voice7 from "./assets/voice-ai-7-actor.webp";
import VoiceCardItem from "./VoiceCardItem";

// 간단한 아바타 매핑 (서버 imageUrl 키값 -> 로컬 에셋)
const AVATAR_MAP: Record<string, string> = {
    "avatar_1": voice1,
    "avatar_2": voice2,
    "avatar_3": voice3,
    "avatar_4": voice4,
    "avatar_5": voice5,
    "avatar_6": voice6,
    "avatar_7": voice7,
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
            <section className="h-full rounded-xl border bg-white shadow-sm flex flex-col p-6 font-sans">
                <header className="flex flex-col space-y-1.5 pb-6 flex-none">
                    <h3 className="font-semibold leading-none tracking-tight">③ AI 보이스 선택</h3>
                </header>
                <div className="flex-1">보이스 목록을 불러오는 중...</div>
            </section>
        );
    }

    const selectedAvatar = getAvatar(selected);

    return (
        <section className="h-full rounded-xl border bg-white shadow-sm flex flex-col font-sans">
            <header className="flex flex-col space-y-1.5 p-6 pb-0 flex-none">
                <h3 className="font-semibold leading-none tracking-tight">③ AI 보이스 선택</h3>
            </header>

            <div className="p-6 pt-6 flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* 상단: 선택된 카드 요약 */}
                <div className="flex flex-col gap-2.5 mb-4 flex-none">
                    <div className="flex items-center gap-3 border border-gray-100 rounded-xl p-3.5 bg-gray-50 font-bold">
                        <img
                            className="w-11 h-11 rounded-full object-cover border border-gray-200 flex-none"
                            src={selectedAvatar}
                            alt=""
                        />
                        <div className="flex items-center gap-2.5">
                            <div className="font-bold">{selected.name}</div>
                            <span
                                className={[
                                    "inline-flex items-center h-[22px] px-2.5 rounded-full text-xs border",
                                    selected.status === "READY" ? "bg-teal-50 border-teal-400 text-teal-700 font-bold" : "",
                                    selected.status === "LOADING" ? "bg-orange-50 border-orange-200" : "",
                                    selected.status === "ERROR" ? "bg-gray-100 border-gray-200" : "",
                                    !selected.status || (selected.status !== "READY" && selected.status !== "LOADING" && selected.status !== "ERROR") ? "bg-white border-gray-200" : ""
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar" role="list">
                    {voices.map((v) => (
                        <VoiceCardItem
                            key={v.id}
                            voice={v}
                            isActive={v.id === voiceId}
                            avatar={getAvatar(v)}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
