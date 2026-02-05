import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
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
        navigate('/start');
    };

    return (
        <motion.div
            className="h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex flex-col font-sans overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
        >
            {/* 헤더 */}
            <motion.header
                className="px-8 py-6 flex justify-start flex-none"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
            >
                <Button
                    variant="ghost"
                    fullWidth={false}
                    onClick={handleBack}
                    className="gap-2 hover:bg-orange-100 hover:text-[#E8753A] transition-colors text-gray-600"
                >
                    <ArrowLeft className="h-5 w-5" />
                    홈으로
                </Button>
            </motion.header>

            <div className="flex-1 px-8 pb-8 max-w-7xl mx-auto w-full overflow-hidden flex flex-col">
                <motion.div
                    className="mb-6 flex-none flex items-center justify-between"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                >
                    <h1 className="text-3xl font-bold text-gray-900">Host - 사전 점검</h1>
                    <HealthBadgesPanel health={model.health} />
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">
                    {/* 좌측 */}
                    <motion.div
                        className="lg:col-span-5 space-y-6"
                        initial={{ x: -30, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
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
                    </motion.div>

                    {/* 우측(상태 + 버튼) */}
                    <motion.div
                        className="lg:col-span-7 flex flex-col gap-6 h-full min-h-0"
                        initial={{ x: 30, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                    >
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
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );
}
