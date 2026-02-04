import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import '../intro.css';

export function HeroSection() {
    return (
        <section className="intro-hero-section">
            {/* Background Gradients */}
            <div className="intro-hero-bg-wrapper">
                <div className="intro-hero-bg-gradient-1" />
                <div className="intro-hero-bg-gradient-2" />
            </div>

            <div className="intro-hero-content">
                <div className="intro-badge">
                    <Sparkles className="w-4 h-4 text-[#E8753A]" />
                    <span className="text-sm font-medium text-gray-600">AI 기반 실시간 리마스터링 스트리밍</span>
                </div>

                <h1 className="intro-hero-title">
                    내가 원하는 <span className="intro-hero-highlight-orange">목소리</span>와
                    <br />
                    <span className="intro-hero-highlight-blue">얼굴</span>로
                    정보를 전달받다
                </h1>

                <p className="intro-hero-subtitle">
                    Speaky는 당신의 페르소나를 재구성하여 콘텐츠의 몰입감을 극대화합니다.
                    <br className="hidden md:block" />
                    지금 바로 차세대 스트리밍을 경험해보세요.
                </p>

                <div className="intro-hero-actions">
                    <Link to="/start" className="intro-primary-btn group">
                        시작하기
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </div>
        </section>
    );
}
