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
       * - loginId 필드 사용
       */
      await login({ loginId: id.trim(), password });

      // 토큰 저장/인증 상태 변경 알림
      window.dispatchEvent(new Event('auth-change'));
      onSuccess?.();
    } catch (err) {
      setFormError('로그인에 실패했습니다. 아이디와 비밀번호를 확인해주세요.');
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
    </Card>
  );
}
