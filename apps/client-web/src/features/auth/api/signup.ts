import { apiFetch } from '../../../shared/lib/apiFetch';

type SignupRequest = {
    loginId: string;
    password: string;
    name: string;
};

export async function signup(req: SignupRequest) {
    const res = await apiFetch('/api/v1/users', {
        method: 'POST',
        auth: false,
        body: JSON.stringify(req),
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || '회원가입 실패');
    }

    return true;
}
