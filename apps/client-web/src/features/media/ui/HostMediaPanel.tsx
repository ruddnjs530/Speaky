import { useRef } from 'react';

import StreamPreview from '../../screenShare/ui/StreamPreview';
import AudioControl from './AudioControl';
import type { ConnectionStatus } from '../model/useConnectionStatus';

type Props = {
    status?: ConnectionStatus;
    stream: MediaStream | null;
    title?: string;
    muted?: boolean;
};

export default function HostMediaPanel({
                                           stream,
                                           title = '송출 미리보기',
                                           muted = true,
                                       }: Props) {
    const videoRef = useRef<HTMLVideoElement | null>(null);

    return (
        <div style={{ display: 'grid', gap: 10 }}>
            <StreamPreview ref={videoRef} title={title} stream={stream} muted={muted} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <AudioControl mediaRef={videoRef} />
            </div>
        </div>
    );
}
