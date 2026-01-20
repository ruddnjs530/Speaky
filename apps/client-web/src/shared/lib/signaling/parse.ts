import type { Envelope, Role } from './envelope';

type AnyObj = Record<string, unknown>;

function isObj(v: unknown): v is AnyObj {
  return typeof v === 'object' && v !== null;
}

function isRole(v: unknown): v is Role {
  return v === 'HOST' || v === 'GUEST' || v === 'SC';
}

// 들어온 raw(JSON string)을 Envelope로 파싱, 검증. 실패하면 null
export function parseEnvelope(raw: unknown, logPrefix = '[WS]'): Envelope | null {
  if (typeof raw !== 'string') {
    console.warn(logPrefix, 'drop: non-string message', raw);
    return null;
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    console.warn(logPrefix, 'drop: invalid JSON', raw);
    return null;
  }

  if (!isObj(data)) {
    console.warn(logPrefix, 'drop: not an object', data);
    return null;
  }

  // 필수: v/type/requestId/ts/channelId/sessionId/from.role/from.clientId
  if (data.v !== 1) {
    console.warn(logPrefix, 'drop: invalid v', data.v);
    return null;
  }
  if (typeof data.type !== 'string' || data.type.length === 0) {
    console.warn(logPrefix, 'drop: missing type', data);
    return null;
  }
  if (typeof data.requestId !== 'string' || data.requestId.length === 0) {
    console.warn(logPrefix, 'drop: missing requestId', data);
    return null;
  }
  if (typeof data.ts !== 'number') {
    console.warn(logPrefix, 'drop: missing/invalid ts', data);
    return null;
  }
  if (typeof data.channelId !== 'string' || data.channelId.length === 0) {
    console.warn(logPrefix, 'drop: missing channelId', data);
    return null;
  }
  if (typeof data.sessionId !== 'string' || data.sessionId.length === 0) {
    console.warn(logPrefix, 'drop: missing sessionId', data);
    return null;
  }

  const from = (data as AnyObj).from;
  if (!isObj(from)) {
    console.warn(logPrefix, 'drop: missing from', data);
    return null;
  }
  if (!isRole(from.role)) {
    console.warn(logPrefix, 'drop: invalid from.role', from);
    return null;
  }
  if (typeof from.clientId !== 'string' || from.clientId.length === 0) {
    console.warn(logPrefix, 'drop: missing from.clientId', from);
    return null;
  }

  return data as Envelope;
}
