import { useIntersectionObserver } from '../../../shared/hooks/useIntersectionObserver';

const teamMembers = [
    { name: '김성진', role: 'Team Leader / Backend (Signaling)', sub: '팀장 / 백엔드 / 시그널링 서버', image: '/team/sungjin.png' },
    { name: '김경원', role: 'Frontend Lead', sub: '프론트엔드 리드', image: '/team/kyungwon.png' },
    { name: '신형섭', role: 'Frontend Developer', sub: '프론트엔드 개발', image: '/team/hyeongseop.png' },
    { name: '신동륜', role: 'AI R&D', sub: 'AI 연구 개발', image: '/team/dongryun.png' },
    { name: '김현민', role: 'Backend / Media Server', sub: '백엔드 / 미디어 서버 / 인프라', image: '/team/hyunmin.png' },
    { name: '강한별', role: 'Backend / AI Server', sub: '백엔드 / AI 서버', image: '/team/hanbyeol.png' },
];

export function TeamSection() {
    const { elementRef, isVisible } = useIntersectionObserver({ threshold: 0.2 });

    return (
        <section ref={elementRef} className="py-24 bg-slate-50 text-gray-900 border-t border-gray-200">
            <div className={`max-w-7xl mx-auto px-6 opacity-0 translate-y-10 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : ''}`}>
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold text-gray-900 !text-3xl md:!text-4xl">Team SHE AWESOME YOUTH</h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                    {teamMembers.map((member, index) => (
                        <div
                            key={index}
                            className={`text-center p-6 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-[#E8753A]/30 transition-all duration-500 opacity-0 translate-y-10 ${isVisible ? 'opacity-100 translate-y-0' : ''}`}
                            style={{ transitionDelay: `${index * 100}ms` }}
                        >
                            <div className="w-20 h-20 mx-auto rounded-full bg-linear-to-br from-gray-100 to-gray-200 mb-4 flex items-center justify-center text-2xl font-bold text-gray-400 overflow-hidden">
                                {member.image ? (
                                    <img src={member.image} alt={member.name} className="w-full h-full object-cover" />
                                ) : (
                                    member.name[0]
                                )}
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">{member.name}</h3>
                            <p className="text-xs text-[#E8753A] font-medium uppercase tracking-wide mb-1">{member.role}</p>
                            <p className="text-xs text-gray-500">{member.sub}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
