import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { login } from '../api/login';
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

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError('');
    setTouched({ id: true, password: true });

    if (!canSubmit) return;

    setIsSubmitting(true);

    try {
      /**
       * 실제 백엔드 로그인 시도
       * login() 함수는 내부에서 accessToken을 저장하도록 구현되어 있으면 더 좋고,
       * 아니면 여기서 data.accessToken 받아서 저장해도 됨.
       */
      await login({ id: id.trim(), password });

      // 토큰 저장/인증 상태 변경 알림(프로젝트에서 쓰는 방식 유지)
      window.dispatchEvent(new Event('auth-change'));
      onSuccess?.();
    } catch (err) {
      /**
       * 백엔드가 아직 없거나(404/네트워크 에러),
       * 스펙이 아직 안 맞는 동안 개발이 막히지 않도록 fallback 유지
       * - test / 1234 는 성공
       */
      const isBackendNotReady =
        err instanceof Error &&
        (err.message.includes('Failed to fetch') ||
          err.message.includes('404') ||
          err.message.includes('login') ||
          err.message.includes('로그인'));

      if (isBackendNotReady) {
        // ===== fallback: fake login =====
        const success = id.trim() === 'test' && password === '1234';

        if (success) {
          localStorage.setItem('accessToken', 'fake-token');
          setIsSubmitting(false);
          window.dispatchEvent(new Event('auth-change'));
          onSuccess?.();
          return;
        }

        setFormError('아이디 또는 비밀번호가 올바르지 않습니다.');
      } else {
        // 진짜 서버에서 내려준 실패일 가능성
        setFormError('로그인에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setIsSubmitting(false);
    }
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

      {/* TODO : viewer로 연결하는 링크 */}
      <a href="#" className="login-subtitle" onClick={(e) => e.preventDefault()}>
        비회원으로 시청하기
      </a>

      {/* 테스트 계정 힌트 */}
      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
        테스트 로그인: id <b>test</b>, pw <b>1234</b>
      </div>
    </Card>
  );
}
