import type { AudioDevice } from "../hooks/usePrecheckModel.ts";
import "./MicDeviceSelectRow.css";

interface Props {
    disabled: boolean;
    devices: AudioDevice[];
    selectedDeviceId: string | null;
    onSelect: (deviceId: string) => void;
}

export default function MicDeviceSelectRow({
                                               disabled,
                                               devices,
                                               selectedDeviceId,
                                               onSelect,
                                           }: Props) {
    return (
        <div className={["deviceRow", disabled ? "is-disabled" : ""].filter(Boolean).join(" ")}>
            <div className="deviceRow__left">
                <div className="deviceRow__title">마이크 선택</div>
                <div className="deviceRow__desc">
                    {disabled ? "권한 허용 후 선택 가능" : "입력 장치를 선택하세요"}
                </div>
            </div>

            <select
                className="deviceRow__select"
                disabled={disabled}
                value={selectedDeviceId ?? ""}
                onChange={(e) => onSelect(e.target.value)}
            >
                <option value="" disabled>
                    선택
                </option>
                {devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                        {d.label}
                    </option>
                ))}
            </select>
        </div>
    );
}
