export type RoomPhase = 'waiting' | 'live' | 'ended' | 'error';

type RoomStatusResponse =
  | { phase: RoomPhase }
  | { status: string }
  | { live: boolean }
  | { isLive: boolean }
  | { ended: boolean }
  | Record<string, unknown>;

function normalizeRoomPhase(data: RoomStatusResponse): RoomPhase {
  // phase 
  if (typeof (data as any).phase === 'string') {
    const p = (data as any).phase;
    if (p === 'waiting' || p === 'live' || p === 'ended') return p;
  }

  // status 문자열 
  if (typeof (data as any).status === 'string') {
    const s = (data as any).status.toLowerCase();
    if (s.includes('wait')) return 'waiting';
    if (s.includes('live') || s.includes('start')) return 'live';
    if (s.includes('end') || s.includes('close')) return 'ended';
  }

  // boolean 플래그 
  if ((data as any).ended === true) return 'ended';
  if ((data as any).live === true || (data as any).isLive === true) return 'live';

  // 애매해서 waiting
  return 'waiting';
}

export async function fetchRoomPhase(roomId: string): Promise<RoomPhase> {
  // endpoint는 백엔드가 나중에 정할 곳
  // 임시로 "/api/rooms/:roomId/status"라고 가정해둠
  const res = await fetch(`/api/rooms/${roomId}/status`);
  if (!res.ok) return 'error';

  const data = (await res.json()) as RoomStatusResponse;
  return normalizeRoomPhase(data);
}
