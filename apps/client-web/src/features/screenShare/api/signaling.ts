type OfferArgs = {
  role: 'host' | 'viewer';
  roomId?: string;
};

export async function sendOfferToServer(
  offer: RTCSessionDescriptionInit,
  { role, roomId }: OfferArgs
): Promise<RTCSessionDescriptionInit> {
  const qs = new URLSearchParams({ role });
  if (roomId) qs.set('roomId', roomId);

  const res = await fetch(`/api/webrtc/offer?${qs.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(offer),
  });

  if (!res.ok) throw new Error('offer 전송 실패');
  return (await res.json()) as RTCSessionDescriptionInit;
}
