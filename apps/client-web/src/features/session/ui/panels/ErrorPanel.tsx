import { useNavigate } from "react-router-dom";
import { clearAccessToken } from "../../../../shared/lib/authToken";
import { useAppDispatch, useAppStateValue } from "../../state/useAppState";
import ErrorDialog from "../ErrorDialog";
import type { SysErrorActionType } from "../../errors/sysErrorUx";

export function ErrorPanel() {
    const state = useAppStateValue();
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    const err = state.context.lastError;

    const handleAction = (type: SysErrorActionType) => {
        switch (type) {
            case "retry":
                dispatch({ type: "RETRY" });
                return;

            case "reset":
                dispatch({ type: "RESET" });
                return;

            case "login":
                // UNAUTHORIZED 등에서 “로그인”을 누르면 토큰 정리 후 로그인으로 이동
                clearAccessToken();
                navigate("/login");
                return;

            case "exit":
                // 팀 UX에 따라 "/" 대신 navigate(-1)도 가능
                navigate("/");
                return;

            default:
                // 타입상 도달하지 않지만, 안전장치
                dispatch({ type: "RESET" });
        }
    };

    if (!err) {
        // Error 상태인데 lastError가 없는 경우(예외 케이스)
        return (
            <div style={{ padding: 16 }}>
                <h2>Error</h2>
                <p>오류 정보가 없습니다. 초기화 후 다시 시도해 주세요.</p>
                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => dispatch({ type: "RESET" })}>Reset</button>
                    <button onClick={() => navigate("/")}>Exit</button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: 16 }}>
            <ErrorDialog
                open={true}
                error={err}
                onAction={handleAction}
                // 디버그 텍스트를 항상 켜고 싶으면 true
                showDebug={false}
            />
        </div>
    );
}
