import { useAppStateValue } from "../../state/useAppState";
import type { AppStateKind } from "../../state/appState.types";
import ConnectionBadge, { type ConnectionStatus } from "../components/ConnectionBadge";
import HealthPanel, { type HealthItem, type HealthState } from "../components/HealthPanel";

function statusFromKind(kind: AppStateKind): ConnectionStatus {
    switch (kind) {
        case "SessionReady":
            return "idle";
        case "WsConnecting":
        case "Attached":
            return "wss";
        case "PcConnecting":
            return "webrtc";
        case "Connected":
            return "connected";
        case "Reconnecting":
            return "reconnecting";
        case "Error":
            return "failed";
        default:
            return "idle";
    }
}

function messageFromKind(kind: AppStateKind): string {
    switch (kind) {
        case "SessionReady":
            return "준비가 완료되었습니다. 연결을 시작할 수 있습니다.";
        case "WsConnecting":
            return "시그널링 서버(WSS)에 연결 중입니다.";
        case "Attached":
            return "시그널링 연결이 완료되었습니다. WebRTC 협상을 준비합니다.";
        case "PcConnecting":
            return "WebRTC 협상(ICE/DTLS)을 진행 중입니다.";
        case "Connected":
            return "연결이 완료되었습니다.";
        case "Reconnecting":
            return "연결이 불안정하여 재연결을 시도 중입니다.";
        case "Error":
            return "연결에 실패했습니다.";
        default:
            return "처리 중입니다…";
    }
}

function stepStates(kind: AppStateKind): {
    permission: HealthState;
    rest: HealthState;
    wss: HealthState;
    webrtc: HealthState;
} {
    switch (kind) {
        case "WsConnecting":
            return { permission: "ok", rest: "ok", wss: "unknown", webrtc: "unknown" };
        case "Attached":
            return { permission: "ok", rest: "ok", wss: "ok", webrtc: "unknown" };
        case "PcConnecting":
            return { permission: "ok", rest: "ok", wss: "ok", webrtc: "unknown" };
        case "Connected":
            return { permission: "ok", rest: "ok", wss: "ok", webrtc: "ok" };
        case "Reconnecting":
            return { permission: "ok", rest: "ok", wss: "warn", webrtc: "warn" };
        case "Error":
            return { permission: "ok", rest: "ok", wss: "fail", webrtc: "fail" };
        default:
            // Idle/SessionReady 등
            return { permission: "unknown", rest: "unknown", wss: "unknown", webrtc: "unknown" };
    }
}

export function LoadingPanel() {
    const state = useAppStateValue();
    const kind = state.kind;

    const status = statusFromKind(kind);
    const states = stepStates(kind);

    const items: HealthItem[] = [
        {
            key: "permission",
            label: "권한(마이크/화면 공유)",
            state: states.permission,
            description: "브라우저 권한이 필요합니다.",
        },
        {
            key: "rest",
            label: "세션 준비(REST)",
            state: states.rest,
            description: "세션 정보를 가져오고 초기 상태를 구성합니다.",
        },
        {
            key: "wss",
            label: "시그널링 연결(WSS)",
            state: states.wss,
            description: "Offer/Answer/ICE 교환을 위한 서버 연결입니다.",
        },
        {
            key: "webrtc",
            label: "WebRTC 연결(ICE/DTLS)",
            state: states.webrtc,
            description: "PeerConnection 협상 및 미디어 연결 단계입니다.",
        },
    ];

    return (
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <ConnectionBadge status={status} message={messageFromKind(kind)} />
            <HealthPanel items={items} />
        </div>
    );
}
