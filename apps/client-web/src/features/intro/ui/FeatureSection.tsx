import { Mic2, Zap, MonitorPlay } from 'lucide-react';
import { useIntersectionObserver } from '../../../shared/hooks/useIntersectionObserver';

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
        <section ref={elementRef} className="py-24 bg-white text-gray-900 border-t border-gray-100">
            <div className={`max-w-7xl mx-auto px-6 opacity-0 translate-y-10 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : ''}`}>
                <div className="text-center mb-16">
                    <h2 className="text-sm font-bold text-[#E8753A] tracking-wider uppercase mb-3">Key Features</h2>
                    <h3 className="text-3xl md:text-5xl font-bold text-gray-900">
                        왜 Speaky인가요?
                    </h3>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            className={`p-8 rounded-3xl bg-white border border-gray-100 hover:border-[#E8753A]/30 hover:shadow-xl hover:-translate-y-1 transition-all duration-500 shadow-sm opacity-0 translate-y-10 group ${isVisible ? 'opacity-100 translate-y-0' : ''}`}
                            style={{ transitionDelay: `${index * 200}ms` }}
                        >
                            <div className="w-16 h-16 rounded-2xl bg-[#E8753A]/10 flex items-center justify-center mb-6 border border-[#E8753A]/10 group-hover:scale-110 transition-transform duration-300">
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
