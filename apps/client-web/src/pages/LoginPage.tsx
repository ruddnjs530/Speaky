import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Button from '../shared/ui/Button';
import LoginForm from '../features/auth/ui/LoginForm';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    navigate('/');
  };

  const handleNavigateToSignup = () => {
    navigate('/signup');
  };

  const handleLoginSuccess = () => {
    // 이전 페이지 정보가 있다면 거기로, 없다면 홈으로
    const from = location.state?.from || '/';
    navigate(from, { replace: true });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex flex-col font-sans">
      {/* 헤더 */}
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

      {/* 메인 콘텐츠 */}
      <main className="flex-1 flex items-center justify-center px-8 pb-20">
        <LoginForm
          onNavigateToSignup={handleNavigateToSignup}
          onLoginSuccess={handleLoginSuccess}
        />
      </main>
    </div>
  );
}
