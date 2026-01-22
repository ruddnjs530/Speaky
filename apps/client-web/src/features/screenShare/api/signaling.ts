import { createEnvelope, type Role } from '../../../shared/lib/signaling/envelope';
import type { SignalingClient } from '../../../shared/lib/signaling/SignalingClient';

export type SignalArgs = {
  channelId: string;
  sessionId: string;
  role: Role;
};

function opts({ channelId, sessionId, role }: SignalArgs) {
  return { channelId, sessionId, from: { role } };
}

export function sendOfferWS(
  client: SignalingClient,
  offer: RTCSessionDescriptionInit,
  args: SignalArgs
) {
  client.send(createEnvelope('SIG_SDP_OFFER', opts(args), { sdp: offer }));
}

export function sendAnswerWS(
  client: SignalingClient,
  answer: RTCSessionDescriptionInit,
  args: SignalArgs
) {
  client.send(createEnvelope('SIG_SDP_ANSWER', opts(args), { sdp: answer }));
}

export function sendIceWS(
  client: SignalingClient,
  candidate: RTCIceCandidateInit,
  args: SignalArgs
) {
  client.send(createEnvelope('SIG_ICE', opts(args), { candidate }));
}

export function sendAttachWS(
    client: SignalingClient,
    args: SignalArgs,
    payload: { resume?: boolean } = { resume: false }
) {
  client.send(createEnvelope('SYS_ATTACH', opts(args), payload));
}

