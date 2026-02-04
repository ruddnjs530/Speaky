import type { AudioDevice } from "../hooks/usePrecheckModel.ts";

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
        <div className={`flex items-center justify-between gap-3 p-3 border border-gray-200 rounded-xl ${disabled ? 'opacity-65' : ''}`}>
            <div className="flex-none">
                <div className="font-bold text-gray-900">마이크 선택</div>
                <div className="mt-1 text-xs text-gray-500">
                    {disabled ? "권한 허용 후 선택 가능" : "입력 장치를 선택하세요"}
                </div>
            </div>

            <select
                className="px-2.5 py-2 rounded-lg border border-gray-200 bg-white text-sm max-w-[240px] truncate focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
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
