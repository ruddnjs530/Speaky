import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export function HeroSection() {
    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center pt-32 pb-20 overflow-hidden bg-slate-50 text-gray-900">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#E8753A] rounded-full blur-[120px] opacity-10 animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px] opacity-10" />
            </div>

            <div className="relative z-10 w-full max-w-7xl mx-auto px-6 text-center animate-[intro-fade-in-up_1s_ease-out_forwards]">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white backdrop-blur-md border border-gray-200 mb-8 shadow-sm">
                    <Sparkles className="w-4 h-4 text-[#E8753A]" />
                    <span className="text-sm font-medium text-gray-600">AI 기반 실시간 리마스터링 스트리밍</span>
                </div>

                <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-tight">
                    내가 원하는 <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E8753A] to-[#F0B13A]">목소리</span>와
                    <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-600">얼굴</span>로
                    정보를 전달받다
                </h1>

                <p className="text-xl md:text-2xl text-gray-500 mb-12 max-w-5xl mx-auto leading-relaxed md:whitespace-nowrap">
                    Speaky는 당신의 페르소나를 재구성하여 콘텐츠의 몰입감을 극대화합니다.
                    <br className="hidden md:block" />
                    지금 바로 차세대 스트리밍을 경험해보세요.
                </p>

                <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                    <Link to="/start" className="px-8 py-4 bg-[#E8753A] hover:bg-[#D45A3A] text-white rounded-full font-bold text-lg transition-all transform hover:scale-105 shadow-lg shadow-[#E8753A]/25 flex items-center gap-2 group">
                        시작하기
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </div>
            {/* Inline keyframes for the custom animation */}
            <style>{`
                @keyframes intro-fade-in-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </section>
    );
}
