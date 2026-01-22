import { forwardRef, useEffect, useRef } from 'react';
import type { ForwardedRef } from 'react';
import Card from '../../../shared/ui/Card';

type Props = {
    title: string;
    stream: MediaStream | null;
    muted?: boolean;
};

function setRef<T>(ref: ForwardedRef<T>, value: T) {
    if (typeof ref === 'function') {
        ref(value);
    } else if (ref !== null) {
        // ForwardedRef<T>의 object ref 케이스는 RefObject<T> 형태입니다.
        // readonly current이지만 실제 런타임에 할당 가능하므로 아래처럼 처리합니다.
        (ref as { current: T }).current = value;
    }
}

const StreamPreview = forwardRef<HTMLVideoElement, Props>(
    ({ title, stream, muted = false }, ref) => {
        const localRef = useRef<HTMLVideoElement | null>(null);

        useEffect(() => {
            const v = localRef.current;
            if (!v) return;

            v.srcObject = stream;
            v.playsInline = true;
            v.muted = Boolean(muted);

            return () => {
                v.srcObject = null;
            };
        }, [stream, muted]);

        return (
            <Card className="p-3">
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>

                {stream ? (
                    <video
                        ref={(el) => {
                            localRef.current = el;
                            setRef(ref, el);
                        }}
                        autoPlay
                        playsInline
                        muted={muted}
                        style={{ width: '100%', background: '#000', borderRadius: 8 }}
                    />
                ) : (
                    <div
                        style={{
                            width: '100%',
                            height: 360,
                            background: '#eee',
                            borderRadius: 8,
                            display: 'grid',
                            placeItems: 'center',
                        }}
                    >
                        서버 미리보기가 여기에 표시됩니다.
                    </div>
                )}
            </Card>
        );
    }
);

StreamPreview.displayName = 'StreamPreview';
export default StreamPreview;
