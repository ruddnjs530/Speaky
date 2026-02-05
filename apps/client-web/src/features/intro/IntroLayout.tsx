import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";

export function IntroLayout({ children }: PropsWithChildren) {
    return (
        <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-[#E8753A] selection:text-white">
            {/* Navbar */}
            <nav className="fixed top-0 left-0 w-full z-50 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link to="/" className="text-2xl font-bold text-[#E8753A] tracking-tight">
                        Speaky
                    </Link>
                    <div className="flex items-center gap-6">
                        <Link
                            to="/start"
                            className="px-4 py-2 rounded-full bg-white text-black text-sm font-bold hover:bg-gray-200 transition-colors"
                        >
                            시작하기
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Content */}
            <main>
                {children}
            </main>

            {/* Footer */}
            <footer className="py-8 bg-white border-t border-gray-100 text-center text-gray-500 text-sm">
                <p>© 2026 Speaky. All rights reserved.</p>
            </footer>
        </div>
    );
}
