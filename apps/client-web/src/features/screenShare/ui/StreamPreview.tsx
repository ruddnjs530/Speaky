import { forwardRef, useEffect } from 'react';
import type { Ref } from 'react';

import Card from '../../../shared/ui/Card';

type Props = {
  title: string;
  stream: MediaStream | null;
  muted?: boolean;
};

function setRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === 'function') ref(value);
  else ref.current = value;
}

const StreamPreview = forwardRef<HTMLVideoElement, Props>(
    ({ title, stream, muted = false }, ref) => {
      useEffect(() => {
        if (!ref || typeof ref === 'function') return;

        const v = ref.current;
        if (!v) return;

        v.srcObject = stream;
        if (stream) void v.play().catch(() => {});

        return () => {
          v.srcObject = null;
        };
      }, [stream, ref]);

      return (
          <Card className="p-3">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>

            {stream ? (
                <video
                    ref={(el) => setRef(ref, el)}
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
