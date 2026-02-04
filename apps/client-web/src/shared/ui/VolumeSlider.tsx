import { useRef, useState } from 'react';

type VolumeSliderProps = {
    value: number; // 0 ~ 1
    onChange: (value: number) => void;
    className?: string;
};

export default function VolumeSlider({ value, onChange, className = '' }: VolumeSliderProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // 드래그 또는 클릭 시 값 업데이트
    const updateValue = (clientX: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const width = rect.width;

        // 0 ~ 1 사이 값으로 클램핑
        const newValue = Math.max(0, Math.min(x / width, 1));
        onChange(newValue);
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDragging(true);
        updateValue(e.clientX);
        // 포인터 캡처 설정 (드래그가 벗어나도 추적)
        (e.target as Element).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (isDragging) {
            updateValue(e.clientX);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
        (e.target as Element).releasePointerCapture(e.pointerId);
    };

    // 퍼센트 계산 (0 ~ 100)
    const percentage = Math.round(value * 100);

    return (
        <div
            className={`relative flex items-center gap-1.5 group/slider ${className}`}
        >
            {/* Slider Track Area */}
            <div
                ref={containerRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className="relative flex-1 h-4 cursor-pointer touch-none flex items-center transition-transform duration-200 ease-out origin-left group-hover/slider:scale-y-110"
            >
                {/* Track Background - Toned down but visible */}
                <div className="w-full h-1.5 bg-zinc-600/50 rounded-full overflow-hidden backdrop-blur-sm">
                    {/* Fill Bar - Luxurious gray */}
                    <div
                        className="h-full bg-zinc-400 rounded-full transition-all duration-150 ease-out group-hover/slider:bg-zinc-300"
                        style={{ width: `${value * 100}%` }}
                    />
                </div>
            </div>

            {/* Percentage Text (Right side) */}
            <div
                className="text-zinc-300 font-medium text-xs font-mono w-8 text-right pointer-events-none"
            >
                {percentage}
            </div>
        </div>
    );
}
