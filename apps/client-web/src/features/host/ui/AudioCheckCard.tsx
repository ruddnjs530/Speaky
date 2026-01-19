import Card from "../../../shared/ui/Card";
import type { AudioDevice, MicState } from "../hooks/usePrecheckModel.ts";
import MicPermissionRow from "./MicPermissionRow";
import MicDeviceSelectRow from "./MicDeviceSelectRow";
import InputLevelMeter from "./InputLevelMeter";
import "./AudioCheckCard.css";

interface Props {
    mic: MicState;
    devices: AudioDevice[];
    actions: {
        requestMicPermission: () => void;
        selectMicDevice: (deviceId: string) => void;
        startLevelMonitor: () => void;
        stopLevelMonitor: () => void;
    };
}

export default function AudioCheckCard({ mic, devices, actions }: Props) {
    const canSelect = mic.permission === "granted";
    const canMonitor = mic.permission === "granted" && !!mic.selectedDeviceId;

    return (
        // TODO: 마이크 권한/장치/레벨
        <Card title="② 오디오 확인" >
            <div className="audioCheck__stack">
                <MicPermissionRow mic={mic} onRequest={actions.requestMicPermission} />

                <MicDeviceSelectRow
                    disabled={!canSelect}
                    devices={devices}
                    selectedDeviceId={mic.selectedDeviceId}
                    onSelect={actions.selectMicDevice}
                />

                <InputLevelMeter
                    disabled={!canMonitor}
                    level={mic.level}
                    onStart={actions.startLevelMonitor}
                    onStop={actions.stopLevelMonitor}
                />
            </div>
        </Card>
    );
}
