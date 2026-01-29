import { getAccessToken, clearAccessToken } from './authToken';

type ApiFetchOptions = RequestInit & {
  auth?: boolean; // 기본 true: 토큰 붙이기
};

export async function apiFetch(input: RequestInfo | URL, options: ApiFetchOptions = {}) {
  const { auth = true, headers, ...rest } = options;

  const token = auth ? getAccessToken() : null;

  // URL에 VITE_API_URL 환경 변수 적용
  let url = input;
  if (typeof input === 'string' && input.startsWith('/')) {
    const baseUrl = import.meta.env.VITE_API_URL || '';
    url = `${baseUrl}${input}`;
  }

  const res = await fetch(url, {
    ...rest,
    headers: {
      ...(headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  // 토큰 만료/인증 실패 처리
  if (res.status === 401) {
    clearAccessToken();
    // 여기서 라우터 이동/로그아웃 처리 해도 됨
  }

  return res;
}
