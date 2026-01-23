import type { Envelope } from '../../../shared/lib/signaling/envelope';

export type SigIcePayload = {
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
};

export type ApplySignalingDeps = {
    channelId: string;
    sessionId: string;

    pc: RTCPeerConnection;

    remoteDescSetRef: { current: boolean };
    pendingRemoteIceRef: { current: RTCIceCandidateInit[] };

    flushPendingRemoteIce: () => Promise<void>;

    onSysError: (msg: string) => void;
    onConnected: () => void;
};

export async function applySignalingEnvelope(
    env: Envelope,
    deps: ApplySignalingDeps
) {
    if (env.channelId !== deps.channelId) return;
    if (env.sessionId !== deps.sessionId) return;

    if (env.type === 'SYS_ERROR') {
        const p = env.payload as { code: string; msg?: string } | undefined;
        deps.onSysError(p?.msg ? `${p.code}: ${p.msg}` : p?.code ?? 'SYS_ERROR');
        return;
    }

    if (env.type === 'SIG_ANSWER') {
        const p = env.payload as { sdpType: 'answer'; sdp: string } | undefined;
        if (!p?.sdp) return;

        await deps.pc.setRemoteDescription({ type: p.sdpType, sdp: p.sdp });
        deps.remoteDescSetRef.current = true;
        await deps.flushPendingRemoteIce();
        deps.onConnected();
        return;
    }

    if (env.type === 'SIG_ICE') {
        const p = env.payload as SigIcePayload | undefined;
        if (!p?.candidate) return;

        const ice: RTCIceCandidateInit = {
            candidate: p.candidate,
            sdpMid: p.sdpMid ?? undefined,
            sdpMLineIndex: p.sdpMLineIndex ?? undefined,
        };

        if (!deps.remoteDescSetRef.current) {
            deps.pendingRemoteIceRef.current.push(ice);
            return;
        }

        try {
            await deps.pc.addIceCandidate(ice);
        } catch {
            // ignore
        }
    }
}
