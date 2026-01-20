import { useState } from "react";
import { useSessionBootstrap } from "../../hooks/useSessionBootstrap";

export function IdlePanel() {
    const { start, join } = useSessionBootstrap();
    const [channelId, setChannelId] = useState("");

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
