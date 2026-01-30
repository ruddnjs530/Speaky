import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useSessionBootstrap } from "../../hooks/useSessionBootstrap";
import "./IdlePanel.css";

export function IdlePanel() {
    const { start, join, startHost } = useSessionBootstrap();
    const { pathname } = useLocation();

    const [open, setOpen] = useState(false);
    const [channelId, setChannelId] = useState("");

    const isHostStudio = pathname.startsWith("/host/studio");

    // Host studio: channelId 입력 없이 "내 채널로 시작"만 노출
    const renderHostContent = () => (
        <>
            <div className="idleRow">
                <p style={{ fontSize: 12, opacity: 0.8 }}>
                    호스트 채널 정보를 기반으로 방송 세션을 생성합니다.
                </p>
            </div>
            <div className="idleActions">
                <button className="idleBtn" onClick={() => { startHost("Host Session"); setOpen(false); }}>
                    Start Live (REST)
                </button>
            </div>
        </>
    );

    // Viewer/기타: 기존대로 channelId 입력해서 join
    const renderViewerContent = () => (
        <>
            <div className="idleRow">
                <label style={{ fontSize: 12 }}>channelId</label>
                <input
                    className="idleInput"
                    value={channelId}
                    onChange={(e) => setChannelId(e.target.value)}
                    placeholder="Enter channel ID..."
                />
            </div>

            <div className="idleActions">
                <button
                    className="idleBtn"
                    onClick={() => { start(channelId); setOpen(false); }}
                    disabled={!channelId.trim()}
                >
                    Host: Start
                </button>
                <button
                    className="idleBtn"
                    onClick={() => { join(channelId); setOpen(false); }}
                    disabled={!channelId.trim()}
                >
                    Guest: Join
                </button>
            </div>
        </>
    );

    return (
        <div className="idleRoot">
            <button className="idleFab" onClick={() => setOpen((v) => !v)}>
                Idle Setup
            </button>

            {open && (
                <div className="idlePanel">
                    <div className="idleHeader">
                        <span className="idleTitle">Session Setup (Dev)</span>
                        <button className="idleClose" onClick={() => setOpen(false)}>✕</button>
                    </div>

                    {isHostStudio ? renderHostContent() : renderViewerContent()}
                </div>
            )}
        </div>
    );
}
