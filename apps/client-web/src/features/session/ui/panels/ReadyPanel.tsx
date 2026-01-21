import { useNavigate } from "react-router-dom";

import Button from "../../../../shared/ui/Button";
import ConnectionBadge from "../components/ConnectionBadge";
import HealthPanel, { type HealthItem } from "../components/HealthPanel";
import { useAppDispatch } from "../../state/useAppState";

export function ReadyPanel() {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    const items: HealthItem[] = [
        {
            key: "permission",
            label: "권한(마이크/화면 공유)",
            state: "ok",
            description: "브라우저 권한이 확인되었습니다.",
        },
        {
            key: "rest",
            label: "세션 준비(REST)",
            state: "ok",
            description: "세션 정보를 가져왔습니다.",
        },
        {
            key: "wss",
            label: "시그널링 연결(WSS)",
            state: "unknown",
            description: "연결 시작 버튼을 누르면 시그널링 연결을 시도합니다.",
        },
        {
            key: "webrtc",
            label: "WebRTC 연결(ICE/DTLS)",
            state: "unknown",
            description: "시그널링 연결 이후 WebRTC 협상이 진행됩니다.",
        },
    ];

    const onStartConnect = () => {
        /**
         * TODO(중요):
         * 현재 AppState 머신에서 사용 중인 이벤트명 다시 한번 확인
         */
        dispatch({ type: "WS_CONNECT_START" });
    };

    const onExit = () => {
        /**
         * TODO:
         * 팀 라우팅 정책에 맞게 더블 체크
         */
        navigate("/");
    };

    return (
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <ConnectionBadge
                status="idle"
                message="준비가 완료되었습니다. 연결을 시작할 수 있습니다."
            />
            <HealthPanel items={items} />

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Button variant="secondary" fullWidth={false} onClick={onExit}>
                    나가기
                </Button>
                <Button variant="primary" fullWidth={false} onClick={onStartConnect}>
                    연결 시작
                </Button>
            </div>
        </div>
    );
}
