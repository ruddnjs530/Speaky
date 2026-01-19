import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Card from '../../../shared/ui/Card';

type FormErrors = {
    id?: string;
    password?: string;
};

type LoginFormProps = {
    onSuccess?: () => void;
};

export default function LoginForm({ onSuccess }: LoginFormProps) {
    const [id, setId] = useState('');
    const [password, setPassword] = useState('');
    const [touched, setTouched] = useState<{ id: boolean; password: boolean }>({
        id: false,
        password: false,
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string>('');

    const errors: FormErrors = useMemo(() => {
        const next: FormErrors = {};
        if (!id.trim()) next.id = '아이디를 입력하세요.';
        if (!password) next.password = '비밀번호를 입력하세요.';
        return next;
    }, [id, password]);

    const canSubmit = !errors.id && !errors.password && !isSubmitting;

    const onSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setFormError('');

        // 터치 처리(제출 시 전체 표시)
        setTouched({ id: true, password: true });

        if (!canSubmit) return;

        setIsSubmitting(true);

        // Day1: 실제 API 연결 대신 "가짜 로그인" (성공/실패 흐름 확인용)
        setTimeout(() => {
            const success = id.trim() === 'test' && password === '1234';

            if (success) {
                // 로그인 성공 처리(나중에 백엔드 토큰으로 교체)
                localStorage.setItem('accessToken', 'fake-token');
                setIsSubmitting(false);
                window.dispatchEvent(new Event("auth-change")); 
                onSuccess?.();
                return;
            }

            // 로그인 실패 처리
            setIsSubmitting(false);
            setFormError('아이디 또는 비밀번호가 올바르지 않습니다.');
        }, 900);
    };

    return (
        <Card className="login-card">
            <h2 className="login-title">로그인</h2>

            <form onSubmit={onSubmit} className="form">
                <Input
                    label="아이디"
                    name="id"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, id: true }))}
                    placeholder="아이디를 입력하세요"
                    autoComplete="username"
                    error={touched.id ? errors.id : undefined}
                />

                <Input
                    label="비밀번호"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                    placeholder="비밀번호를 입력하세요"
                    autoComplete="current-password"
                    error={touched.password ? errors.password : undefined}
                />

                {formError && <div className="form-error">{formError}</div>}

                <Button type="submit" disabled={!canSubmit}>
                    {isSubmitting ? '로그인 중...' : '로그인'}
                </Button>
            </form>

            {/*TODO : viewer로 연결하는 링크 */}
            <a
                href="#"
                className="login-subtitle"
                onClick={(e) => e.preventDefault()}
            >
                비회원으로 시청하기
            </a>

            {/* (선택) 테스트 계정 힌트 */}
            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
                테스트 로그인: id <b>test</b>, pw <b>1234</b>
            </div>
        </Card>
    );
}
