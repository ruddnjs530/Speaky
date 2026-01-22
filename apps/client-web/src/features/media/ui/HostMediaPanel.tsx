import StreamPreview from '../../screenShare/ui/StreamPreview';
import AudioControl from './AudioControl';
import type { ConnectionStatus } from '../model/useConnectionStatus';
import {useState} from "react";

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

    const [mediaEl, setMediaEl] = useState<HTMLVideoElement | null>(null);

    return (
        <div style={{ display: 'grid', gap: 10 }}>
            <StreamPreview ref={setMediaEl} title={title} stream={stream} muted={muted} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <AudioControl mediaEl={mediaEl} />
            </div>
        </div>
    );
}
