import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

type MediaEl = HTMLVideoElement | HTMLAudioElement;

type Props = {
    mediaRef: RefObject<MediaEl | null>;
    className?: string;
};

export default function AudioControl({ mediaRef, className }: Props) {
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);

    useEffect(() => {
        const el = mediaRef.current;
        if (!el) return;

        el.volume = volume;
        el.muted = muted || volume === 0;
    }, [volume, muted, mediaRef]);

    const effectiveMuted = muted || volume === 0;

    return (
        <div className={className ?? ''} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" onClick={() => setMuted((v) => !v)}>
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
                aria-label="volume"
            />

            <span style={{ width: 44, textAlign: 'right', fontSize: 12 }}>
        {Math.round(volume * 100)}%
      </span>
        </div>
    );
}
