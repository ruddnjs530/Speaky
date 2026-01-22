
import type { AppError } from "../../state/appState.types";
import Button from "../../../../shared/ui/Button";
import Card from "../../../../shared/ui/Card";
import {
    getSysErrorUx,
    type SysErrorActionType,
    type SysErrorUxAction,
} from "../../errors/sysErrorUx";

export interface ErrorDialogProps {
    error: AppError;
    /** true면 렌더링, false면 null */
    open: boolean;
    /**
     * 버튼 액션 클릭 시 상위에서 처리:
     * - retry: 재시도
     * - reset: 초기화 후 재시도
     * - login: 로그인 페이지로 이동
     * - exit: 나가기(홈/뒤로가기 등)
     */
    onAction: (type: SysErrorActionType) => void;

    /** 개발/디버그용 상세 메시지 노출 여부 (선택) */
    showDebug?: boolean;
}

function toButtonVariant(action: SysErrorUxAction): "primary" | "secondary" {
    // shared Button이 primary/secondary만 지원하므로 여기서 매핑합니다.
    return action.kind === "primary" ? "primary" : "secondary";
}

export default function ErrorDialog({
                                        error,
                                        open,
                                        onAction,
                                        showDebug = false,
                                    }: ErrorDialogProps) {
    if (!open) return null;

    const spec = getSysErrorUx(error);

    return (
        <Card
            title={spec.title}
            subtitle={`code: ${spec.code}`}
            // 모달 스타일은 다음 단계에서 CSS로 강화할 수 있습니다.
            style={{ maxWidth: 520, margin: "0 auto" }}
        >
            <p style={{ marginTop: 0 }}>{spec.message}</p>

            {showDebug && error.message && (
                <pre
                    style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 8,
                        overflow: "auto",
                        background: "rgba(0,0,0,0.04)",
                        fontSize: 12,
                    }}
                >
                    {error.message}
                </pre>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                {spec.actions.map((a) => (
                    <Button
                        key={a.type}
                        variant={toButtonVariant(a)}
                        fullWidth={false}
                        onClick={() => onAction(a.type)}
                    >
                        {a.label}
                    </Button>
                ))}
            </div>
        </Card>
    );
}
