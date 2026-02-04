import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";
import './intro.css';

export function IntroLayout({ children }: PropsWithChildren) {
    return (
        <div className="intro-layout-container">
            {/* Navbar */}
            <nav className="intro-navbar">
                <div className="intro-navbar-content">
                    <Link to="/" className="intro-logo">
                        Speaky
                    </Link>
                    <div className="intro-nav-actions">
                        <Link
                            to="/start"
                            className="intro-nav-cta"
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
            <footer className="intro-footer">
                <p>© 2026 Speaky. All rights reserved.</p>
            </footer>
        </div>
    );
}
