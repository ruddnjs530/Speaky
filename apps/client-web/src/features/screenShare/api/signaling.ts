import type { SignalingClient } from '../../../shared/lib/signaling/SignalingClient';

export function sendOfferWS(
  client: SignalingClient,
  offer: RTCSessionDescriptionInit
) {
  if (!offer.sdp) return;
  client.sendTyped('SIG_OFFER', { sdpType: 'offer', sdp: offer.sdp });
}

export function sendAnswerWS(
  client: SignalingClient,
  answer: RTCSessionDescriptionInit
) {
  if (!answer.sdp) return;
  client.sendTyped('SIG_ANSWER', { sdpType: 'answer', sdp: answer.sdp });
}

export function sendIceWS(
  client: SignalingClient,
  candidate: RTCIceCandidate
) {
  client.sendTyped('SIG_ICE', {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex,
  });
}

export function sendAttachWS(
  client: SignalingClient,
  payload: { resume?: boolean } = { resume: false }
) {
  // SignalingClient.attach() 메서드가 이미 존재하므로 그것을 활용하거나 sendTyped 사용
  // 여기서는 일관성을 위해 sendTyped 사용 (SignalingClient.attach는 내부적으로 sendRaw 호출)
  client.sendTyped('SYS_ATTACH', payload);
}

