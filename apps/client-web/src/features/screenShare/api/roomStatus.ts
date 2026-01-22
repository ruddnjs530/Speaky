export type RoomPhase = 'waiting' | 'live' | 'ended' | 'error';

type RoomStatusResponse =
  | { phase: RoomPhase }
  | { status: string }
  | { live: boolean }
  | { isLive: boolean }
  | { ended: boolean }
  | Record<string, unknown>;

function normalizeRoomPhase(data: RoomStatusResponse): RoomPhase {

  // TODO(Day3-B): status 문자열 파싱(wait/live/end 포함)은 임시 방편입니다.
  // 계약 확정 시 정확한 enum(phase) 또는 boolean 필드로만 판정하도록 변경하세요.
  if (typeof (data as any).phase === 'string') {
    const p = (data as any).phase;
    if (p === 'waiting' || p === 'live' || p === 'ended') return p;
  }

  if (typeof (data as any).status === 'string') {
    const s = (data as any).status.toLowerCase();
    if (s.includes('wait')) return 'waiting';
    if (s.includes('live') || s.includes('start')) return 'live';
    if (s.includes('end') || s.includes('close')) return 'ended';
  }

  if ((data as any).ended === true) return 'ended';
  if ((data as any).live === true || (data as any).isLive === true) return 'live';

  return 'waiting';
}

export async function fetchRoomPhase(roomId: string): Promise<RoomPhase> {

  // TODO(Day3-B): endpoint(/api/rooms/{roomId}/status) 및 실패 시 처리('error')는 임시입니다.
  // 최종적으로는 SESSION_NOT_ACTIVE/ENDED를 명확한 코드로 받아 UI 분기를 고정해야 합니다.
  const res = await fetch(`/api/rooms/${roomId}/status`);
  if (!res.ok) return 'error';

  const data = (await res.json()) as RoomStatusResponse;
  return normalizeRoomPhase(data);
}

export type SignalingBootstrap = {
  channelId: string;
  sessionId: string;
  wsUrl: string;
  signalingToken: string;
};

export async function startLive(channelId: string): Promise<SignalingBootstrap> {
  const res = await fetch(`/api/channels/${channelId}/sessions`, { method: 'POST' });
  if (!res.ok) throw new Error('방송 시작 실패');
  return (await res.json()) as SignalingBootstrap;
}

export async function joinViewer(channelId: string, sessionId: string): Promise<SignalingBootstrap> {
  const res = await fetch(`/api/channels/${channelId}/sessions/${sessionId}/viewers`, { method: 'POST' });
  if (!res.ok) throw new Error('시청 입장 실패');
  return (await res.json()) as SignalingBootstrap;
}

export async function endLive(channelId: string, sessionId: string): Promise<void> {
  const res = await fetch(`/api/channels/${channelId}/sessions/${sessionId}/end`, { method: 'POST' });
  if (!res.ok) throw new Error('방송 종료 실패');
}
