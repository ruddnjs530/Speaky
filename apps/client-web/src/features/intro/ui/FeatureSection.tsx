import { Mic2, Zap, MonitorPlay } from 'lucide-react';
import { useIntersectionObserver } from '../../../shared/hooks/useIntersectionObserver';
import '../intro.css';

const features = [
    {
        icon: <Mic2 className="w-8 h-8 text-[#E8753A]" />,
        title: "실시간 AI 음성 변조",
        description: "RVC(Retrieval-based Voice Conversion) 기술을 활용하여 지연 없는 고품질 실시간 음성 변환을 제공합니다. 원하는 목소리로 자유롭게 소통하세요."
    },
    {
        icon: <Zap className="w-8 h-8 text-blue-500" />,
        title: "몰입감 있는 전달력",
        description: "청취자의 뇌가 반응하는 매력적인 목소리는 인지 자원을 절약하고 정보 전달 효율을 극대화합니다. 더 강력한 전달력을 경험하세요."
    },
    {
        icon: <MonitorPlay className="w-8 h-8 text-indigo-500" />,
        title: "누구나 되는 버추얼 크리에이터",
        description: "폭발하는 버추얼 이코노미 시장. 강력한 팬덤과 소비력을 가진 이 시장에 당신만의 페르소나로 즉시 참여할 수 있습니다."
    }
];

export function FeatureSection() {
    const { elementRef, isVisible } = useIntersectionObserver({ threshold: 0.3 });

    return (
        <section ref={elementRef} className="intro-feature-section">
            <div className={`intro-feature-container fade-in-up ${isVisible ? 'visible' : ''}`}>
                <div className="intro-section-header">
                    <h2 className="intro-section-label">Key Features</h2>
                    <h3 className="intro-section-title">
                        왜 Speaky인가요?
                    </h3>
                </div>

                <div className="intro-feature-grid">
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            className={`intro-feature-card group ${isVisible ? 'visible' : ''}`}
                        >
                            <div className="intro-feature-icon-wrapper">
                                {feature.icon}
                            </div>
                            <h4 className="text-xl font-bold mb-4 text-gray-900">{feature.title}</h4>
                            <p className="text-gray-500 leading-relaxed">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
