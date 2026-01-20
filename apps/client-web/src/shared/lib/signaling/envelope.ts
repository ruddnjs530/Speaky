export type Role = 'HOST' | 'GUEST' | 'SC';

export type Envelope<T = unknown> = {
  v: 1;
  type: string;

  requestId: string;
  ts: number;

  channelId: string;   
  sessionId: string;   

  from: {
    role: Role;
    clientId: string;  
  };

  payload?: T;
};

const CLIENT_ID_KEY = 'clientId';

export function getOrCreateClientId(): string {
  const existing = localStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;

  const newId = safeUUID();
  localStorage.setItem(CLIENT_ID_KEY, newId);
  return newId;
}

export function newRequestId(): string {
  return safeUUID();
}

type CreateEnvelopeOpts = {
  channelId: string;
  sessionId: string;
  from: { role: Role; clientId?: string };
  requestId?: string;
  ts?: number;
};

export function createEnvelope<T>(
  type: string,
  opts: CreateEnvelopeOpts,
  payload?: T
): Envelope<T> {
  const clientId = opts.from.clientId ?? getOrCreateClientId();

  return {
    v: 1,
    type,
    requestId: opts.requestId ?? newRequestId(),
    ts: opts.ts ?? Date.now(),
    channelId: opts.channelId,
    sessionId: opts.sessionId,
    from: { role: opts.from.role, clientId },
    payload,
  };
}

function safeUUID(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
