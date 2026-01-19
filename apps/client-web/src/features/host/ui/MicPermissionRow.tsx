import type { MicState } from "../hooks/usePrecheckModel.ts";
import "./MicPermissionRow.css";

interface Props {
    mic: MicState;
    onRequest: () => void;
}

export default function MicPermissionRow({ mic, onRequest }: Props) {
    const text = (() => {
        switch (mic.permission) {
            case "idle":
                return "권한 요청 전";
            case "requesting":
                return "요청 중...";
            case "granted":
                return "권한 허용됨";
            case "denied":
                return "권한 거부됨";
            case "error":
                return "오류";
            default:
                return "알 수 없음";
        }
    })();

    return (
        <div className="micRow">
            <div className="micRow__left">
                <div className="micRow__title">마이크 권한</div>
                <div className="micRow__desc">{text}</div>
            </div>

            <button
                type="button"
                className="micRow__btn"
                onClick={onRequest}
                disabled={mic.permission === "requesting"}
            >
                권한 요청
            </button>
        </div>
    );
}
