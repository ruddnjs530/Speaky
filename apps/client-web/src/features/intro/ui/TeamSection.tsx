import { useIntersectionObserver } from '../../../shared/hooks/useIntersectionObserver';
import '../intro.css';

const teamMembers = [
    { name: '김성진', role: 'Team Leader / Backend (Signaling)', sub: '팀장 / 백엔드 / 시그널링 서버', image: '/team/김성진.png' },
    { name: '김경원', role: 'Frontend Lead', sub: '프론트엔드 리드', image: '/team/김경원.png' },
    { name: '신형섭', role: 'Frontend Developer', sub: '프론트엔드 개발', image: '/team/신형섭.png' },
    { name: '신동륜', role: 'AI R&D', sub: 'AI 연구 개발', image: '/team/신동륜.png' },
    { name: '김현민', role: 'Backend / Media Server', sub: '백엔드 / 미디어 서버 / 인프라', image: '/team/김현민.png' },
    { name: '강한별', role: 'Backend / AI Server', sub: '백엔드 / AI 서버', image: '/team/강한별.png' },
];

export function TeamSection() {
    const { elementRef, isVisible } = useIntersectionObserver({ threshold: 0.2 });

    return (
        <section ref={elementRef} className="intro-team-section">
            <div className={`intro-team-container fade-in-up ${isVisible ? 'visible' : ''}`}>
                <div className="intro-section-header">
                    <h2 className="intro-section-title !text-3xl md:!text-4xl">Team SHE AWESOME YOUTH</h2>
                </div>

                <div className="intro-team-grid">
                    {teamMembers.map((member, index) => (
                        <div
                            key={index}
                            className={`intro-team-card ${isVisible ? 'visible' : ''}`}
                        >
                            <div className="intro-team-avatar">
                                {member.image ? (
                                    <img src={member.image} alt={member.name} className="intro-team-img" />
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
