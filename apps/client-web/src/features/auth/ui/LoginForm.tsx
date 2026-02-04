import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff } from 'lucide-react';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import { Label } from '../../../shared/ui/Label';
import Card from '../../../shared/ui/Card';
import Checkbox from '../../../shared/ui/Checkbox';
import { login } from '../api/login';

interface LoginFormProps {
  onNavigateToSignup: () => void;
  onLoginSuccess: () => void;
}

export default function LoginForm({ onNavigateToSignup, onLoginSuccess }: LoginFormProps) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await login({ loginId: loginId.trim(), password });

      console.log('로그인 성공:', { loginId, rememberMe });
      onLoginSuccess();
    } catch (error) {
      console.error(error);
      alert('로그인에 실패했습니다. 아이디와 비밀번호를 확인해주세요.');
    }
  };

  return (
    <Card className="w-full max-w-md p-8 bg-white shadow-xl rounded-2xl">
      {/* 로고 */}
      <div className="text-center mb-8">
        <h1 className="text-[#E8753A] mb-2 text-2xl font-bold">Speaky</h1>
        <p className="text-gray-500">계정에 로그인하세요</p>
      </div>

      {/* 로그인 폼 */}
      <form onSubmit={handleLogin} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="loginId">아이디</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              id="loginId"
              type="text"
              placeholder="아이디를 입력하세요"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="pl-10"
              required
            />
          </div>
        </div>

        {/* 비밀번호 입력 */}
        <div className="space-y-2">
          <Label htmlFor="password">비밀번호</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* 로그인 유지 및 비밀번호 찾기 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked)}
            />
            <Label htmlFor="remember" className="text-sm cursor-pointer text-gray-600">
              로그인 상태 유지
            </Label>
          </div>
          <button
            type="button"
            className="text-sm text-[#E8753A] hover:underline font-medium"
          >
            비밀번호 찾기
          </button>
        </div>

        {/* 로그인 버튼 */}
        <Button
          type="submit"
          className="w-full bg-[#E8753A] hover:bg-[#D45A3A] text-white h-11 font-bold text-lg"
        >
          로그인
        </Button>
      </form>

      {/* 회원가입 링크 */}
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          계정이 없으신가요?{' '}
          <button
            type="button"
            onClick={onNavigateToSignup}
            className="text-[#E8753A] hover:underline font-medium"
          >
            회원가입
          </button>
        </p>
      </div>
    </Card>
  );
}
