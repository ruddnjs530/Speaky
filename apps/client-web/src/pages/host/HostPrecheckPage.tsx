import { useNavigate } from "react-router-dom";
import InputSourceCard from "../../features/host/ui/InputSourceCard";
import AudioCheckCard from "../../features/host/ui/AudioCheckCard";
import VoiceSelectPanel from "../../features/host/ui/VoiceSelectPanel";
import HealthBadgesPanel from "../../features/host/ui/HealthBadgesPanel";
import PrecheckFooter from "../../features/host/ui/PrecheckFooter";
import { usePrecheckModel } from "../../features/host/hooks/usePrecheckModel.ts";

import "./HostPrecheckPage.css";

export default function HostPrecheckPage() {
    const navigate = useNavigate();

    const model = usePrecheckModel({
        onNext: () => navigate("/host/studio", { state: { voiceId: model.voiceId } }),
    });

    return (
        <div className="precheck-page">
            <h1 className="precheck-page__title">Host - 사전 점검</h1>
            <p className="precheck-page__subtitle">
                방송 시작 전 입력 소스, 오디오, AI 보이스를 확인합니다.
            </p>

            <div className="precheck-grid">
                {/* 좌측(①,②) */}
                <div className="precheck-col">
                    <InputSourceCard
                        inputSource={model.inputSource}
                        onSelect={model.actions.selectInputSource}
                    />

                    <AudioCheckCard
                        mic={model.mic}
                        devices={model.devices}
                        actions={{
                            requestMicPermission: model.actions.requestMicPermission,
                            selectMicDevice: model.actions.selectMicDevice,
                            startLevelMonitor: model.actions.startLevelMonitor,
                            stopLevelMonitor: model.actions.stopLevelMonitor,
                        }}
                    />
                </div>

                {/* 우측(③ + 상태 + 버튼) */}
                <div className="precheck-col">
                    <VoiceSelectPanel
                        voices={model.voices}
                        voiceId={model.voiceId}
                        onSelect={model.actions.selectVoice}
                    />
                    <HealthBadgesPanel health={model.health} />
                    <PrecheckFooter
                        disabled={!model.canProceed}
                        onReset={model.actions.reset}
                        onNext={model.actions.goNext}
                    />
                </div>
            </div>
        </div>
    );
}
