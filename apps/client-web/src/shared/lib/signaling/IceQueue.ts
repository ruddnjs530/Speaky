export type IceCandidateLike = {
    candidate: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
};

export class IceQueue {
    private buf: IceCandidateLike[] = [];

    enqueue(c: IceCandidateLike) {
        if (!c?.candidate) return;
        this.buf.push(c);
    }

    async flush(add: (c: RTCIceCandidateInit) => Promise<void> | void) {
        const items = this.buf;
        this.buf = [];
        for (const it of items) {
            await add({
                candidate: it.candidate,
                sdpMid: it.sdpMid ?? null,
                sdpMLineIndex: it.sdpMLineIndex ?? null,
            });
        }
    }

    clear() {
        this.buf = [];
    }
}
