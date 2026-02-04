import { Monitor, Users } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { RoleCard } from '../features/home/ui/RoleCard';
import { HostCardPattern } from '../features/home/ui/HostCardPattern';
import { ViewerCardPattern } from '../features/home/ui/ViewerCardPattern';

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
      {/* 헤더 */}
      <motion.header
        className="px-8 py-6 flex items-center justify-between"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl font-bold text-[#E8753A]">Speaky</h1>

        <motion.div
          className="flex items-center gap-4"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {authed ? (
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              로그아웃
            </button>
          ) : (
            <>
              <Link
                to="/login"
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                로그인
              </Link>
              <Link
                to="/signup" // 회원가입 페이지 경로
                className="px-4 py-2 rounded-lg text-sm font-medium text-[#E8753A] hover:bg-[#E8753A]/10 transition-colors"
              >
                회원가입
              </Link>
            </>
          )}
        </motion.div>
      </motion.header>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 flex items-center justify-center px-8 pb-20">
        <div className="w-full max-w-6xl">
          {/* 타이틀 */}
          <motion.div
            className="mb-12 text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {userName ? (
              <>
                <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 tracking-tight">
                  {userName}님, 다시 만나서 반가워요!
                </h2>
                <p className="text-xl text-gray-500">
                  어떤 페르소나로 방송을 시작해볼까요?
                </p>
              </>
            ) : (
              <>
                <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 tracking-tight">
                  실시간 음성 변조 스트리밍
                </h2>
                <p className="text-xl text-gray-500">
                  화면공유 영상의 음성을 실시간으로 변조하여 재송출합니다
                </p>
              </>
            )}
          </motion.div>

          {/* 호스트/뷰어 선택 */}
          <div className="grid md:grid-cols-2 gap-6">
            <RoleCard
              role="host"
              title="Host"
              subtitle="호스트"
              description="화면공유를 시작하고 음성 변조를 설정합니다"
              icon={<Monitor className="h-8 w-8 text-white" />}
              gradient="from-[#D45A3A] to-[#E8753A]"
              onClick={() => handleSelectRole('host')}
              pattern={<HostCardPattern />}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.5,
                ease: [0.25, 0.8, 0.5, 1]
              }}
              whileHover={{
                scale: 1.02,
                boxShadow: "0 20px 40px rgba(232, 117, 58, 0.3)"
              }}
              whileTap={{ scale: 0.98 }}
            />

            <RoleCard
              role="viewer"
              title="Viewer"
              subtitle="뷰어"
              description="변조된 음성이 적용된 스트림을 시청합니다"
              icon={<Users className="h-8 w-8 text-white" />}
              gradient="from-[#E8973A] to-[#F0B13A]"
              onClick={() => handleSelectRole('viewer')}
              pattern={<ViewerCardPattern />}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.5,
                ease: [0.25, 0.8, 0.25, 1]
              }}
              whileHover={{
                scale: 1.02,
                boxShadow: "0 20px 40px rgba(240, 177, 58, 0.3)"
              }}
              whileTap={{ scale: 0.98 }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
