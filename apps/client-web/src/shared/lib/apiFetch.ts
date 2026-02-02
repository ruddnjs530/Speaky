import { getAccessToken, clearAccessToken } from './authToken';

type ApiFetchOptions = RequestInit & {
  auth?: boolean; // 기본 true: 토큰 붙이기
};

export async function apiFetch(input: RequestInfo | URL, options: ApiFetchOptions = {}) {
  const { auth = true, headers, ...rest } = options;


  // 1. URL에 VITE_API_URL 환경 변수 적용
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

  // 2. 헤더 구성 (Headers 객체 활용)
  const reqHeaders = new Headers(headers);
  // 2-1. 토큰 자동 주입
  if (auth) {
    const token = getAccessToken();
    if (token) {
      reqHeaders.set('Authorization', `Bearer ${token}`);
    }
  }
  // 2-2. Content-Type 자동 주입 (JSON)
  // 사용자가 명시하지 않았고, body가 문자열(JSON stringify됨)이라면 JSON 헤더 추가
  if (!reqHeaders.has('Content-Type') && typeof rest.body === 'string') {
    reqHeaders.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...rest,
    headers: reqHeaders,
  });

  // 토큰 만료/인증 실패 처리
  if (res.status === 401) {
    clearAccessToken();
    // 여기서 라우터 이동/로그아웃 처리 해도 됨
  }

  return res;
}
