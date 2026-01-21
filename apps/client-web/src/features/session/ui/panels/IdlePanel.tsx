import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useSessionBootstrap } from "../../hooks/useSessionBootstrap";

export function IdlePanel() {
    const { start, join } = useSessionBootstrap();
    const { pathname } = useLocation();

    const isHostStudio = pathname.startsWith("/host/studio");
    const [channelId, setChannelId] = useState("");

    const { startHost } = useSessionBootstrap();

    // Host studio: channelId 입력 없이 "내 채널로 시작"만 노출
    if (isHostStudio) {
        return (
            <div style={{ padding: 16 }}>
                <h2>세션 준비</h2>
                <p style={{ marginTop: 8 }}>
                    호스트 채널 정보를 기반으로 방송 세션을 생성합니다.
                </p>

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    {/* 핵심: start를 channelId 없이 시작할 수 있도록 useSessionBootstrap을 수정해야 함 */}
                    <button onClick={() => startHost()}>
                        Host: Start Live (REST)
                    </button>
                </div>
            </div>
        );
    }

    // Viewer/기타: 기존대로 channelId 입력해서 join
    return (
        <div style={{ padding: 16 }}>
            <h2>Idle</h2>
            <div style={{ marginTop: 8 }}>
                <label>
                    channelId:
                    <input
                        value={channelId}
                        onChange={(e) => setChannelId(e.target.value)}
                        style={{ marginLeft: 8 }}
                    />
                </label>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={() => start(channelId)} disabled={!channelId.trim()}>
                    Host: Start Live (REST)
                </button>
                <button onClick={() => join(channelId)} disabled={!channelId.trim()}>
                    Guest: Join Live (REST)
                </button>
            </div>
        </div>
    );
}
