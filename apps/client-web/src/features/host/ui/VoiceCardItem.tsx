import type { Voice } from "../api/voiceApi";

interface Props {
    voice: Voice;
    isActive: boolean;
    avatar: string;
    onSelect: (id: number) => void;
}

const STATUS_LABEL: Record<string, string> = {
    READY: "준비",
    LOADING: "로딩 중",
    ERROR: "에러",
};

export default function VoiceCardItem({ voice, isActive, avatar, onSelect }: Props) {
    // 선택된 상태이고 READY라면 '선택됨' 표시
    const isSelectedReady = isActive && voice.status === "READY";

    // 텍스트 결정
    const statusText = isSelectedReady
        ? "선택됨"
        : STATUS_LABEL[voice.status] || voice.status;

    // 상태에 따른 배지 스타일
    const badgeClass = isSelectedReady
        ? "bg-teal-50 border-teal-400 text-teal-700 font-bold"
        : voice.status === "READY"
            ? "bg-green-50 border-green-200 text-gray-900"
            : voice.status === "LOADING"
                ? "bg-orange-50 border-orange-200 text-gray-900"
                : "bg-gray-100 border-gray-200 text-gray-900"; // UNKNOWN/ERROR

    // 카드 컨테이너 클래스 (Tailwind)
    const containerClasses = [
        "flex flex-col items-center gap-3 w-full p-4 text-center border rounded-xl bg-white cursor-pointer transition-all",
        // Hover 효과
        "hover:bg-gray-50 hover:border-gray-300",
        // Active 상태 스타일
        isActive ? "border-gray-900 ring-1 ring-inset ring-gray-900 shadow-sm" : "border-gray-200 shadow-sm",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <button
            type="button"
            role="listitem"
            className={containerClasses}
            onClick={() => onSelect(voice.id)}
            aria-pressed={isActive}
        >
            <img
                className="w-[44px] h-[44px] rounded-full object-cover border border-gray-200 flex-none bg-gray-100"
                src={avatar}
                alt=""
            />
            <div className="flex flex-col items-center gap-2 w-full">
                <div className="font-bold whitespace-nowrap break-keep text-sm text-gray-900">{voice.name}</div>
                <span className={`inline-flex items-center h-[22px] px-2.5 rounded-full text-xs border ${badgeClass}`}>
                    {statusText}
                </span>
            </div>
        </button>
    );
}
