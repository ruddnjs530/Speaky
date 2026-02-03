import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Button from "../../shared/ui/Button";
import InputSourceCard from "../../features/host/ui/InputSourceCard";
import AudioCheckCard from "../../features/host/ui/AudioCheckCard";
import VoiceSelectPanel from "../../features/host/ui/VoiceSelectPanel";
import HealthBadgesPanel from "../../features/host/ui/HealthBadgesPanel";
import PrecheckFooter from "../../features/host/ui/PrecheckFooter";
import { usePrecheckModel } from "../../features/host/hooks/usePrecheckModel.ts";

export default function HostPrecheckPage() {
    const navigate = useNavigate();

    const model = usePrecheckModel({
        onNext: (voiceId) => navigate("/host/studio", { state: { voiceId } }),
    });

    const handleBack = () => {
        navigate('/');
    };

    return (
        <div className="h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex flex-col font-sans overflow-hidden">
            {/* 헤더 */}
            <header className="px-8 py-6 flex justify-start flex-none">
                <Button
                    variant="ghost"
                    fullWidth={false}
                    onClick={handleBack}
                    className="gap-2 hover:bg-orange-100 hover:text-[#E8753A] transition-colors text-gray-600"
                >
                    <ArrowLeft className="h-5 w-5" />
                    홈으로
                </Button>
            </header>

            <div className="flex-1 px-8 pb-8 max-w-7xl mx-auto w-full overflow-hidden flex flex-col">
                <div className="mb-6 flex-none flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-gray-900">Host - 사전 점검</h1>
                    <HealthBadgesPanel health={model.health} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">
                    {/* 좌측 */}
                    <div className="lg:col-span-5 space-y-6">
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

                    {/* 우측(상태 + 버튼) */}
                    <div className="lg:col-span-7 flex flex-col gap-6 h-full min-h-0">
                        <div className="flex-1 min-h-0">
                            <VoiceSelectPanel
                                voices={model.voices}
                                voiceId={model.voiceId}
                                onSelect={model.actions.selectVoice}
                            />
                        </div>
                        <div className="flex-none">
                            <PrecheckFooter
                                disabled={!model.canProceed}
                                onReset={model.actions.reset}
                                onNext={model.actions.goNext}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
