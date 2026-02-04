import { forwardRef, useEffect, useRef } from 'react';
import type { ForwardedRef } from 'react';
import Card from '../../../shared/ui/Card';

type Props = {
    title: string;
    stream: MediaStream | null;
    muted?: boolean;
    variant?: 'card' | 'minimal';
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
    ({ title, stream, muted = false, variant = 'card' }, ref) => {
        const localRef = useRef<HTMLVideoElement | null>(null);

        useEffect(() => {
            const v = localRef.current;
            if (!v) return;

            console.log('StreamPreview: setting srcObject', stream?.id, stream?.getTracks().length);
            v.srcObject = stream;
            v.playsInline = true;
            v.muted = Boolean(muted);

            v.play().catch(e => console.error('StreamPreview: play() failed', e));

            return () => {
                console.log('StreamPreview: cleanup srcObject');
                v.srcObject = null;
            };
        }, [stream, muted]);

        const content = stream ? (
            <video
                ref={(el) => {
                    localRef.current = el;
                    setRef(ref, el);
                }}
                autoPlay
                playsInline
                muted={muted}
                className="w-full h-full object-cover"
                style={variant === 'card' ? { background: '#000', borderRadius: 8 } : { background: '#000' }}
            />
        ) : (
            <div
                style={{
                    width: '100%',
                    height: variant === 'card' ? 360 : '100%',
                    background: variant === 'card' ? '#eee' : '#000',
                    borderRadius: variant === 'card' ? 8 : 0,
                    display: 'grid',
                    placeItems: 'center',
                    color: variant === 'card' ? '#000' : '#444',
                }}
            >
                {variant === 'card' ? '서버 미리보기가 여기에 표시됩니다.' : '신호 없음'}
            </div>
        );

        if (variant === 'minimal') {
            return <div className="w-full h-full relative">{content}</div>;
        }

        return (
            <Card className="p-3">
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
                {content}
            </Card>
        );
    }
);

StreamPreview.displayName = 'StreamPreview';
export default StreamPreview;
