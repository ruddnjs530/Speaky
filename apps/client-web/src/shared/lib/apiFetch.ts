import { getAccessToken, clearAccessToken } from './authToken';

type ApiFetchOptions = RequestInit & {
  auth?: boolean; // 기본 true: 토큰 붙이기
};

export async function apiFetch(input: RequestInfo | URL, options: ApiFetchOptions = {}) {
  const { auth = true, headers, ...rest } = options;

  const token = auth ? getAccessToken() : null;

  // URL에 VITE_API_URL 환경 변수 적용
  let url = input;
  if (typeof input === 'string' && !input.startsWith('http')) {
    const baseUrl = import.meta.env.VITE_API_URL;

    if (!baseUrl) {
      // 개발 편의상 로컬호스트 등에서 테스트할 때를 제외하고는 에러를 띄우는 것이 안전함
      // 여기서는 명확하게 에러를 발생시켜 환경 변수 누락을 알림
      throw new Error('API Error: VITE_API_URL environment variable is not defined.');
    }

    const normalizedInput = input.startsWith('/') ? input : `/${input}`;
    url = `${baseUrl}${normalizedInput}`;
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
