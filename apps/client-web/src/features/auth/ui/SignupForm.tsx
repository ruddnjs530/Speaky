import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff } from 'lucide-react';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import { Label } from '../../../shared/ui/Label';
import Card from '../../../shared/ui/Card';
import Checkbox from '../../../shared/ui/Checkbox';
import { signup } from '../api/signup';

interface SignupFormProps {
    onNavigateToLogin: () => void;
    onSignupSuccess: () => void;
}

export default function SignupForm({ onNavigateToLogin, onSignupSuccess }: SignupFormProps) {
    const [formData, setFormData] = useState({
        name: '',
        loginId: '',
        password: '',
        confirmPassword: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [agreeToTerms, setAgreeToTerms] = useState(false);
    const [agreeToPrivacy, setAgreeToPrivacy] = useState(false);

    const handleChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();

        // 유효성 검사
        if (formData.password !== formData.confirmPassword) {
            alert('비밀번호가 일치하지 않습니다.');
            return;
        }

        if (!agreeToTerms || !agreeToPrivacy) {
            alert('약관에 동의해주세요.');
            return;
        }

        try {
            await signup({
                loginId: formData.loginId.trim(),
                password: formData.password,
                name: formData.name
            });

            console.log('회원가입 성공:', formData);
            alert('회원가입 완료! 로그인 페이지로 이동합니다.');
            onSignupSuccess();
        } catch (error: any) {
            console.error(error);
            alert(error.message || '회원가입 중 오류가 발생했습니다.');
        }
    };

    return (
        <Card className="w-full max-w-md p-8 bg-white shadow-xl rounded-2xl">
            {/* 로고 */}
            <div className="text-center mb-8">
                <h1 className="text-[#E8753A] mb-2 text-2xl font-bold">Speaky</h1>
                <p className="text-gray-500">새 계정을 만드세요</p>
            </div>

            {/* 회원가입 폼 */}
            <form onSubmit={handleSignup} className="space-y-5">
                {/* 이름 입력 */}
                <div className="space-y-2">
                    <Label htmlFor="name">이름</Label>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                            id="name"
                            type="text"
                            placeholder="홍길동"
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            className="pl-10"
                            required
                        />
                    </div>
                </div>

                {/* 아이디 입력 */}
                <div className="space-y-2">
                    <Label htmlFor="loginId">아이디</Label>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                            id="loginId"
                            type="text"
                            placeholder="아이디를 입력하세요"
                            value={formData.loginId}
                            onChange={(e) => handleChange('loginId', e.target.value)}
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
                            placeholder="8자 이상 입력하세요"
                            value={formData.password}
                            onChange={(e) => handleChange('password', e.target.value)}
                            className="pl-10 pr-10"
                            required
                            minLength={8}
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

                {/* 비밀번호 확인 입력 */}
                <div className="space-y-2">
                    <Label htmlFor="confirmPassword">비밀번호 확인</Label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                            id="confirmPassword"
                            type={showConfirmPassword ? 'text' : 'password'}
                            placeholder="비밀번호를 다시 입력하세요"
                            value={formData.confirmPassword}
                            onChange={(e) => handleChange('confirmPassword', e.target.value)}
                            className="pl-10 pr-10"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            {showConfirmPassword ? (
                                <EyeOff className="h-5 w-5" />
                            ) : (
                                <Eye className="h-5 w-5" />
                            )}
                        </button>
                    </div>
                </div>

                {/* 약관 동의 */}
                <div className="space-y-3 pt-2">
                    <div className="flex items-start gap-2">
                        <Checkbox
                            id="terms"
                            checked={agreeToTerms}
                            onCheckedChange={(checked) => setAgreeToTerms(checked)}
                            className="mt-1"
                        />
                        <Label htmlFor="terms" className="text-sm cursor-pointer leading-normal text-gray-600">
                            <span className="text-[#E8753A]">(필수)</span> 서비스 이용약관에 동의합니다
                        </Label>
                    </div>
                    <div className="flex items-start gap-2">
                        <Checkbox
                            id="privacy"
                            checked={agreeToPrivacy}
                            onCheckedChange={(checked) => setAgreeToPrivacy(checked)}
                            className="mt-1"
                        />
                        <Label htmlFor="privacy" className="text-sm cursor-pointer leading-normal text-gray-600">
                            <span className="text-[#E8753A]">(필수)</span> 개인정보 처리방침에 동의합니다
                        </Label>
                    </div>
                </div>

                {/* 회원가입 버튼 */}
                <Button
                    type="submit"
                    className="w-full bg-[#E8753A] hover:bg-[#D45A3A] text-white h-11 font-bold text-lg"
                >
                    회원가입
                </Button>
            </form>

            {/* 구분선 */}
            <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                </div>
            </div>

            {/* 로그인 링크 */}
            <div className="mt-2 text-center">
                <p className="text-sm text-gray-600">
                    이미 계정이 있으신가요?{' '}
                    <button
                        type="button"
                        onClick={onNavigateToLogin}
                        className="text-[#E8753A] hover:underline font-medium"
                    >
                        로그인
                    </button>
                </p>
            </div>
        </Card>
    );
}
