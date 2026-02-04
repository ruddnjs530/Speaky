import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import VolumeSlider from '../../../shared/ui/VolumeSlider';

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
                className="text-white hover:text-orange-400 transition-colors focus:outline-none flex items-center justify-center"
                title={effectiveMuted ? "음소거 해제" : "음소거"}
            >
                {effectiveMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>

            <VolumeSlider
                value={effectiveMuted ? 0 : volume}
                onChange={(v) => {
                    setVolume(v);
                    if (v > 0) setMuted(false);
                }}
                className="w-[120px]"
            />
        </div>
    );
}
