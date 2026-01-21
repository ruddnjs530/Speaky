export type SigType = 'SIG_OFFER' | 'SIG_ANSWER' | 'SIG_ICE';

export type SigOffer = {
  type: 'SIG_OFFER';
  roomId: string;
  sdp: RTCSessionDescriptionInit;
};

export type SigAnswer = {
  type: 'SIG_ANSWER';
  roomId: string;
  sdp: RTCSessionDescriptionInit;
};

export type SigIce = {
  type: 'SIG_ICE';
  roomId: string;
  candidate: RTCIceCandidateInit;
};

export type SigMessage = SigOffer | SigAnswer | SigIce;

export type Envelope<T> = {
  requestId: string;
  ts: number;
  payload: T;
};
