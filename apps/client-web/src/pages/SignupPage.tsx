import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Button from '../shared/ui/Button';
import SignupForm from '../features/auth/ui/SignupForm';

export default function SignupPage() {
    const navigate = useNavigate();

    const handleBack = () => {
        navigate('/');
    };

    const handleNavigateToLogin = () => {
        navigate('/login');
    };

    const handleSignupSuccess = () => {
        navigate('/login');
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
            <main className="flex-1 flex items-center justify-center px-8 py-12">
                <SignupForm
                    onNavigateToLogin={handleNavigateToLogin}
                    onSignupSuccess={handleSignupSuccess}
                />
            </main>
        </div>
    );
}
