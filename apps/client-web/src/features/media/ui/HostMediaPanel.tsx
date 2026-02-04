import StreamPreview from '../../screenShare/ui/StreamPreview';
import AudioControl from './AudioControl';
import type { ConnectionStatus } from '../model/useConnectionStatus';
import { useState, useEffect } from "react";

import { Maximize, Minimize } from 'lucide-react';

type Props = {
    status?: ConnectionStatus;
    stream: MediaStream | null;
    title?: string;
    muted?: boolean;
    className?: string;
};

export default function HostMediaPanel({
    stream,
    title = '송출 미리보기',
    muted = true,
    className = '',
}: Props) {

    const [mediaEl, setMediaEl] = useState<HTMLVideoElement | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    const handleFullscreen = () => {
        if (!mediaEl) return;
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            mediaEl.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        }
    };

    // 전체화면일 때는 호버 시에만 표시, 아닐 때는 항상 표시
    const overlayClass = isFullscreen
        ? "opacity-0 group-hover:opacity-100"
        : "opacity-100";

    return (
        <div className={`relative group bg-black overflow-hidden ${className}`}>
            {/* 비디오 화면 */}
            <StreamPreview
                ref={setMediaEl}
                title={title}
                stream={stream}
                muted={muted}
                variant="minimal"
            />

            {/* 상단 타이틀 오버레이 */}
            <div className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300 pointer-events-none ${overlayClass}`}>
                <h3 className="text-white font-medium text-sm drop-shadow-md">{title}</h3>
            </div>

            {/* 하단 컨트롤 바 오버레이 */}
            <div className={`absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between z-20 ${overlayClass}`}>
                <AudioControl mediaEl={mediaEl} />

                <button
                    type="button"
                    onClick={handleFullscreen}
                    className="text-white hover:text-orange-400 transition-colors p-1.5 rounded-full hover:bg-white/10"
                    title={isFullscreen ? "전체 화면 종료" : "전체 화면"}
                >
                    {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </button>
            </div>
        </div>
    );
}
