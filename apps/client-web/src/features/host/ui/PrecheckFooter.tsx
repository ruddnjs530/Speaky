import "./PrecheckFooter.css";

interface Props {
    disabled: boolean;
    onReset?: () => void;
    onNext?: () => void;
}

export default function PrecheckFooter({ disabled, onReset, onNext }: Props) {
    return (
        <div className="precheckFooter">
            {disabled && (
                <p className="precheckFooter__hint">
                    마이크 권한을 허용하면 다음으로 진행할 수 있습니다.
                </p>
            )}

            <div className="precheckFooter__actions">
                <button type="button" className="precheckFooter__btn" onClick={onReset}>
                    초기화
                </button>

                <button
                    type="button"
                    className={["precheckFooter__btn", "is-primary"].join(" ")}
                    onClick={onNext}
                    disabled={disabled}
                >
                    다음으로
                </button>
            </div>
        </div>
    );
}
