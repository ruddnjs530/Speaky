import { setAccessToken } from '../../../shared/lib/authToken';
import { apiFetch } from '../../../shared/lib/apiFetch';

type LoginRequest = { id: string; password: string };

// 서버 응답 형태에 맞춰 수정해줘.
type LoginResponse = { accessToken: string };

export async function login(req: LoginRequest) {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    auth: false, // 로그인 자체는 토큰 없이
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!res.ok) throw new Error('로그인 실패');

  const data = (await res.json()) as LoginResponse;

  // 여기서 저장
  setAccessToken(data.accessToken);

  return data;
}
