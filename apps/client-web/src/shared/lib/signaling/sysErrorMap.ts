export type SysErrorCode =
  | 'SESSION_NOT_ACTIVE'
  | 'UNAUTHORIZED'
  | 'TOKEN_EXPIRED'
  | 'INVALID_ATTACH'
  | 'CHANNEL_NOT_FOUND'
  | 'SESSION_NOT_FOUND'
  | 'RATE_LIMIT'
  | 'INTERNAL_ERROR'
  | string;

export type ErrorAction = 'retry' | 'leave' | 'login' | 'none';

export type SysErrorUx = {
  title: string;
  description: string;
  primaryAction: ErrorAction;
  primaryLabel: string;
  secondaryAction?: ErrorAction;
  secondaryLabel?: string;
};

const DEFAULT_UX: SysErrorUx = {
  title: '오류가 발생했어요',
  description: '잠시 후 다시 시도해주세요.',
  primaryAction: 'retry',
  primaryLabel: '재시도',
  secondaryAction: 'leave',
  secondaryLabel: '나가기',
};

export const SYS_ERROR_UX_MAP: Record<string, SysErrorUx> = {
  SESSION_NOT_ACTIVE: {
    title: '방송이 진행 중이 아니에요',
    description: '방송이 시작되면 다시 접속할 수 있어요.',
    primaryAction: 'leave',
    primaryLabel: '나가기',
    secondaryAction: 'retry',
    secondaryLabel: '새로고침',
  },
  UNAUTHORIZED: {
    title: '인증이 필요해요',
    description: '로그인이 만료되었거나 권한이 없어요.',
    primaryAction: 'login',
    primaryLabel: '로그인',
    secondaryAction: 'leave',
    secondaryLabel: '나가기',
  },
  TOKEN_EXPIRED: {
    title: '토큰이 만료됐어요',
    description: '다시 로그인한 뒤 재시도해주세요.',
    primaryAction: 'login',
    primaryLabel: '로그인',
    secondaryAction: 'leave',
    secondaryLabel: '나가기',
  },
  INVALID_ATTACH: {
    title: '연결 정보가 올바르지 않아요',
    description: '세션/채널 정보가 맞는지 확인해주세요.',
    primaryAction: 'leave',
    primaryLabel: '나가기',
    secondaryAction: 'retry',
    secondaryLabel: '재시도',
  },
  CHANNEL_NOT_FOUND: {
    title: '채널을 찾을 수 없어요',
    description: '존재하지 않는 채널이거나 삭제되었어요.',
    primaryAction: 'leave',
    primaryLabel: '나가기',
  },
  SESSION_NOT_FOUND: {
    title: '세션을 찾을 수 없어요',
    description: '세션이 만료되었을 수 있어요. 다시 시작해주세요.',
    primaryAction: 'leave',
    primaryLabel: '나가기',
    secondaryAction: 'retry',
    secondaryLabel: '재시도',
  },
  RATE_LIMIT: {
    title: '요청이 너무 많아요',
    description: '잠시 후 다시 시도해주세요.',
    primaryAction: 'retry',
    primaryLabel: '재시도',
    secondaryAction: 'leave',
    secondaryLabel: '나가기',
  },
  INTERNAL_ERROR: {
    title: '서버 오류가 발생했어요',
    description: '잠시 후 다시 시도해주세요.',
    primaryAction: 'retry',
    primaryLabel: '재시도',
    secondaryAction: 'leave',
    secondaryLabel: '나가기',
  },
};

export function mapSysErrorToUx(code: SysErrorCode, msg?: string): SysErrorUx {
  const base = SYS_ERROR_UX_MAP[code] ?? DEFAULT_UX;
  return msg ? { ...base, description: msg } : base;
}
