import Card from "../../../../shared/ui/Card";
import "./ConnectionBadge.css";

export type ConnectionStatus =
    | "idle"
    | "permission"
    | "rest"
    | "wss"
    | "webrtc"
    | "connected"
    | "reconnecting"
    | "failed";

export interface ConnectionBadgeProps {
    status: ConnectionStatus;
    message?: string;
}

function titleOf(status: ConnectionStatus): string {
    switch (status) {
        case "idle":
            return "대기";
        case "permission":
            return "권한 확인 중";
        case "rest":
            return "세션 준비 중";
        case "wss":
            return "시그널링 연결 중";
        case "webrtc":
            return "WebRTC 연결 중";
        case "connected":
            return "연결 완료";
        case "reconnecting":
            return "재연결 중";
        case "failed":
            return "연결 실패";
        default:
            return "상태 확인 중";
    }
}

function subtitleOf(status: ConnectionStatus): string {
    switch (status) {
        case "permission":
            return "마이크/화면 공유 권한이 필요합니다.";
        case "rest":
            return "서버에서 세션 정보를 가져오는 중입니다.";
        case "wss":
            return "시그널링 서버(WSS)에 접속 중입니다.";
        case "webrtc":
            return "ICE/DTLS 협상 진행 중입니다.";
        case "connected":
            return "송출 준비가 완료되었습니다.";
        case "reconnecting":
            return "네트워크 상태를 확인해 주세요.";
        case "failed":
            return "문제를 해결한 뒤 다시 시도해 주세요.";
        default:
            return "진행을 시작해 주세요.";
    }
}

export default function ConnectionBadge({ status, message }: ConnectionBadgeProps) {
    return (
        <Card title={titleOf(status)} subtitle={undefined}>
            <div className="connection-badge">
                <div className="connection-badge__title">{titleOf(status)}</div>
                <div className="connection-badge__subtitle">
                    {message ?? subtitleOf(status)}
                </div>
            </div>
        </Card>
    );
}
