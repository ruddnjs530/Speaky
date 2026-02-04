import { Monitor, Users } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { RoleCard } from '../features/home/ui/RoleCard';

type Role = 'host' | 'viewer';


const isAuthed = () => Boolean(localStorage.getItem("accessToken"));

export default function HomePage() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(isAuthed());
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setAuthed(isAuthed());

    window.addEventListener("storage", sync);
    window.addEventListener("auth-change", sync as EventListener);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("auth-change", sync as EventListener);
    };
  }, []);

  useEffect(() => {
    if (authed) {
      setUserName("싸피");
    } else {
      setUserName(null);
    }
  }, [authed]);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    window.dispatchEvent(new Event("auth-change"));
    setAuthed(false);
    setUserName(null);
    // 로그아웃 후 홈으로 리다이렉트 (현재 페이지가 홈이므로 불필요할 수 있으나 상태 갱신됨)
  };

  const handleSelectRole = (role: Role) => {
    if (role === 'host') {
      // 호스트는 로그인 확인이나 프리체크 페이지로 이동
      navigate('/host/precheck');
    } else {
      // 뷰어는 입장 페이지로 이동
      navigate('/viewer/entry');
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Header */}
      <header className="px-8 py-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#E8753A]">Speaky</h1>

        <div className="flex items-center gap-4">
          {authed ? (
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-[#E8753A] hover:bg-[#D45A3A] transition-colors shadow-sm"
            >
              로그아웃
            </button>
          ) : (
            <>
              <Link
                to="/login"
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
              >
                로그인
              </Link>
              <Link
                to="/signup" // 회원가입 페이지 경로
                className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-[#E8753A] hover:bg-[#D45A3A] transition-colors shadow-sm"
              >
                회원가입
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-8 pb-20">
        <div className="w-full max-w-6xl">
          {/* Title */}
          <div className="mb-12 text-center">
            {userName ? (
              <>
                <h2 className="text-3xl font-bold mb-3 text-gray-900">{userName}님, 다시 만나서 반가워요!</h2>
                <p className="text-lg text-gray-500">
                  어떤 페르소나로 방송을 시작해볼까요?
                </p>
              </>
            ) : (
              <>
                <h2 className="text-3xl font-bold mb-3 text-gray-900">실시간 음성 변조 스트리밍</h2>
                <p className="text-lg text-gray-500">
                  화면공유 영상의 음성을 실시간으로 변조하여 재송출합니다
                </p>
              </>
            )}
          </div>

          {/* Role Selection Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            <RoleCard
              role="host"
              title="Host"
              subtitle="호스트"
              description="화면공유를 시작하고 음성 변조를 설정합니다"
              icon={<Monitor className="h-8 w-8 text-white" />}
              gradient="from-[#D45A3A] to-[#E8753A]"
              onClick={() => handleSelectRole('host')}
              pattern={
                <>
                  <line x1="200" y1="0" x2="280" y2="300" stroke="white" strokeWidth="2" />
                  <line x1="240" y1="0" x2="320" y2="300" stroke="white" strokeWidth="2" />
                  <line x1="280" y1="0" x2="360" y2="300" stroke="white" strokeWidth="2" />
                  <line x1="200" y1="200" x2="350" y2="200" stroke="white" strokeWidth="2" />
                  <line x1="250" y1="250" x2="280" y2="220" stroke="white" strokeWidth="2" />
                </>
              }
            />

            <RoleCard
              role="viewer"
              title="Viewer"
              subtitle="뷰어"
              description="변조된 음성이 적용된 스트림을 시청합니다"
              icon={<Users className="h-8 w-8 text-white" />}
              gradient="from-[#E8973A] to-[#F0B13A]"
              onClick={() => handleSelectRole('viewer')}
              pattern={
                <>
                  <line x1="80" y1="0" x2="160" y2="300" stroke="white" strokeWidth="2" />
                  <line x1="150" y1="0" x2="230" y2="300" stroke="white" strokeWidth="2" />
                  <line x1="220" y1="0" x2="300" y2="300" stroke="white" strokeWidth="2" />
                  <line x1="290" y1="0" x2="370" y2="300" stroke="white" strokeWidth="2" />
                  <line x1="50" y1="150" x2="200" y2="150" stroke="white" strokeWidth="2" />
                  <line x1="250" y1="200" x2="350" y2="200" stroke="white" strokeWidth="2" />
                </>
              }
            />
          </div>
        </div>
      </main>
    </div>
  );
}
