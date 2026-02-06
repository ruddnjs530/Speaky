import type { MicState } from "../hooks/usePrecheckModel.ts";
import "./MicPermissionRow.css";

interface Props {
    mic: MicState;
    onRequest: () => void;
}

export default function MicPermissionRow({ mic, onRequest }: Props) {
    return (
        <div className="micRow">
            <div className="micRow__left">
                <div className="micRow__title">마이크 권한</div>
            </div>

            <button
                type="button"
                className={`micRow__btn ${mic.permission === "granted" ? "micRow__btn--granted" : ""}`}
                onClick={onRequest}
                disabled={mic.permission === "requesting"}
            >
                {mic.permission === "granted" ? "적용됨" : "권한 요청"}
            </button>
        </div>
    );
}
