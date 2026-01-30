import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import Button from '../shared/ui/Button';
import Input from '../shared/ui/Input';
import Label from '../shared/ui/Label';
import Card from '../shared/ui/Card';
import Checkbox from '../shared/ui/Checkbox';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // 실제 로그인 로직 (토큰 저장)
    const token = "dev-token-" + Date.now();
    localStorage.setItem("accessToken", token);
    window.dispatchEvent(new Event("auth-change"));

    console.log('로그인 성공:', { email, rememberMe, token });

    // 홈으로 리다이렉트
    navigate('/', { replace: true });
  };

  const handleBack = () => {
    navigate('/');
  };

  const handleNavigateToSignup = () => {
    navigate('/signup');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex flex-col font-sans">
      {/* Header */}
      <header className="px-8 py-6 flex justify-start">
        <Button
          variant="ghost"
          fullWidth={false}
          onClick={handleBack}
          className="gap-2 hover:bg-orange-100 hover:text-[#E8753A] transition-colors text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
          홈으로
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-8 pb-20">
        <Card className="w-full max-w-md p-8 bg-white shadow-xl rounded-2xl">
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-[#E8753A] mb-2 text-2xl font-bold">Speaky</h1>
            <p className="text-gray-500">계정에 로그인하세요</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email Input */}
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
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

            {/* Remember Me & Forgot Password */}
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

            {/* Login Button */}
            <Button
              type="submit"
              className="w-full bg-[#E8753A] hover:bg-[#D45A3A] text-white h-11 font-bold text-lg"
            >
              로그인
            </Button>
          </form>

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              계정이 없으신가요?{' '}
              <button
                type="button"
                onClick={handleNavigateToSignup}
                className="text-[#E8753A] hover:underline font-medium"
              >
                회원가입
              </button>
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
}
