import { setAccessToken } from '../../../shared/lib/authToken';
import { apiFetch } from '../../../shared/lib/apiFetch';

type LoginRequest = { loginId: string; password: string };

type LoginResponse = {
  success: boolean;
  data: {
    accessToken: string;
  };
  error: string | null;
};

export async function login(req: LoginRequest) {

  const res = await apiFetch('/api/v1/auth/login', {
    method: 'POST',
    auth: false, // 로그인 자체는 토큰 없이
    body: JSON.stringify(req),
  });

  if (!res.ok) throw new Error('로그인 실패');

  const responseBody = (await res.json()) as LoginResponse;
  console.log('Login Response Data:', responseBody); // 디버깅용 로그

  if (!responseBody.success || !responseBody.data) {
    throw new Error(responseBody.error || '로그인 응답 형식이 올바르지 않습니다.');
  }

  // 여기서 저장
  setAccessToken(responseBody.data.accessToken);

  return responseBody.data;
}
