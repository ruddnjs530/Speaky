import Card from "../../../shared/ui/Card";
import type { InputSource } from "../hooks/usePrecheckModel.ts";
import "./InputSourceCard.css";

interface Props {
    inputSource: InputSource;
    onSelect: (v: InputSource) => void;

    // FE-A가 다음 주에 getDisplayMedia 연결할 수 있는 자리
    onOpenScreenShare?: () => void;
}

export default function InputSourceCard({ inputSource, onSelect, onOpenScreenShare }: Props) {
    return (
        // TODO: 
        <Card title="① 입력 소스 선택" >
            <div className="inputSource__buttons">
                <button
                    type="button"
                    className={["inputSource__btn", inputSource === "screen" ? "is-active" : ""]
                        .filter(Boolean)
                        .join(" ")}
                    onClick={async () => {
                        console.log('CLICK startCapture (InputSourceCard)');
                        await onOpenScreenShare?.();
                    }}
                    aria-pressed={inputSource === "screen"}
                >
                    화면 스트리밍
                </button>

                <button
                    type="button"
                    className={["inputSource__btn", inputSource === "mp4" ? "is-active" : ""]
                        .filter(Boolean)
                        .join(" ")}
                    onClick={() => onSelect("mp4")}
                    aria-pressed={inputSource === "mp4"}
                >
                    mp4 업로드
                </button>
            </div>

            <p className="inputSource__selected">
                선택됨: <strong>{inputSource === "screen" ? "화면 스트리밍" : "mp4 업로드"}</strong>
            </p>
        </Card>
    );
}
