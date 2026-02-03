import { useEffect, useState } from 'react';

type Props = {
    mediaEl: HTMLMediaElement | null;
    className?: string;
};

export default function AudioControl({ mediaEl, className }: Props) {
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);

    useEffect(() => {
        const el = mediaEl;
        if (!el) return;

        // eslint-disable-next-line react-hooks/immutability
        el.volume = volume;
        el.muted = muted || volume === 0;
    }, [volume, muted, mediaEl]);

    const effectiveMuted = muted || volume === 0;

    return (
        <div className={`flex items-center gap-2 ${className ?? ''}`}>
            <button
                type="button"
                onClick={() => setMuted((v) => !v)}
                className="text-white hover:text-orange-400 transition-colors focus:outline-none"
                title={effectiveMuted ? "음소거 해제" : "음소거"}
            >
                {effectiveMuted ? '🔇' : '🔊'}
            </button>

            <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={effectiveMuted ? 0 : volume}
                onChange={(e) => {
                    const v = Number(e.target.value);
                    setVolume(v);
                    if (v > 0) setMuted(false);
                }}
                className="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-orange-500"
                aria-label="volume"
            />

            <span className="w-9 text-right text-xs text-white font-mono">
                {Math.round(volume * 100)}%
            </span>
        </div>
    );
}
