import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAccessToken } from '../../../shared/lib/authToken';

/**
 * 인증된 사용자가 아니면 로그인 페이지로 리다이렉트하는 커스텀 훅
 * 리다이렉트 시 원래 페이지 경로를 state로 전달합니다.
 */
export function useAuthRedirect() {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (!getAccessToken()) {
            navigate('/login', { state: { from: location.pathname } });
        }
    }, [navigate, location]);
}
