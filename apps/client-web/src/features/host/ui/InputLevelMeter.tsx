import "./InputLevelMeter.css";

interface Props {
    disabled: boolean;
    level: number; // 0~100
    onStart: () => void;
    onStop: () => void;
}

export default function InputLevelMeter({ disabled, level, onStart, onStop }: Props) {
    const pct = Math.max(0, Math.min(100, level));

    return (
        <div className={["levelRow", disabled ? "is-disabled" : ""].filter(Boolean).join(" ")}>
            <div className="levelRow__left">
                <div className="levelRow__title">입력 레벨</div>

                <div className="levelRow__barOuter" aria-hidden="true">
                    <div className="levelRow__barInner" style={{ width: `${pct}%` }} />
                </div>

                <div className="levelRow__desc">
                    {disabled ? "마이크 선택 후 측정 가능" : `Level: ${pct}`}
                </div>
            </div>

            <div className="levelRow__actions">
                <button type="button" className="levelRow__btn" onClick={onStart} disabled={disabled}>
                    시작
                </button>
                <button type="button" className="levelRow__btn" onClick={onStop}>
                    정지
                </button>
            </div>
        </div>
    );
}
