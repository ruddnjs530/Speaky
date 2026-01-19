import { useMemo, useRef, useState } from "react";

export type InputSource = "screen" | "mp4";

export type MicPermissionState = "idle" | "requesting" | "granted" | "denied" | "error";

export interface AudioDevice {
    deviceId: string;
    label: string;
}

export interface MicState {
    permission: MicPermissionState;
    selectedDeviceId: string | null;
    level: number; // 0~100
    lastError: { code: string; message: string } | null;
}

export interface HealthState {
    mic: "ok" | "warn" | "fail" | "unknown";
    level: "ok" | "warn" | "fail" | "unknown";
    network: "unknown";
    ai: "unknown";
}

export interface PrecheckModel {
    inputSource: InputSource;
    voiceId: string;
    devices: AudioDevice[];
    mic: MicState;
    health: HealthState;
    canProceed: boolean;
    actions: {
        selectInputSource: (next: InputSource) => void;
        selectVoice: (voiceId: string) => void;
        requestMicPermission: () => void;
        selectMicDevice: (deviceId: string) => void;
        startLevelMonitor: () => void;
        stopLevelMonitor: () => void;
        reset: () => void;
        goNext: () => void;
    };
}

const MOCK_DEVICES: AudioDevice[] = [
    { deviceId: "mock-device-1", label: "Microphone (Built-in)" },
    { deviceId: "mock-device-2", label: "USB Microphone" },
    { deviceId: "mock-device-3", label: "Virtual Audio Cable" },
];

export function usePrecheckModel(opts?: { onNext?: () => void }): PrecheckModel {
    // ✅ deps에서 opts 전체를 다루지 않도록 onNext만 분리
    const onNext = opts?.onNext;

    const [inputSource, setInputSource] = useState<InputSource>("screen");
    const [voiceId, setVoiceId] = useState<string>("AI 보이스 1");

    // 스켈레톤 단계: 디바이스 목록은 상수로 고정
    const [devices] = useState<AudioDevice[]>(MOCK_DEVICES);

    const [mic, setMic] = useState<MicState>({
        permission: "idle",
        selectedDeviceId: null,
        level: 0,
        lastError: null,
    });

    const [health, setHealth] = useState<HealthState>({
        mic: "unknown",
        level: "unknown",
        network: "unknown",
        ai: "unknown",
    });

    const levelTimerRef = useRef<number | null>(null);

    const actions = useMemo<PrecheckModel["actions"]>(() => {
        // ✅ useMemo 내부에 helper를 두면 deps 경고가 안 생김
        const stopLevelMonitorImpl = () => {
            if (!levelTimerRef.current) return;

            window.clearInterval(levelTimerRef.current);
            levelTimerRef.current = null;

            setMic((prev) => ({ ...prev, level: 0 }));
            setHealth((prev) => ({ ...prev, level: "unknown" }));
        };

        return {
            selectInputSource: (next) => setInputSource(next),

            selectVoice: (nextVoiceId) => setVoiceId(nextVoiceId),

            requestMicPermission: () => {
                setMic((prev) => ({
                    ...prev,
                    permission: "requesting",
                    lastError: null,
                }));

                window.setTimeout(() => {
                    setMic((prev) => ({
                        ...prev,
                        permission: "granted",
                        selectedDeviceId: prev.selectedDeviceId ?? (MOCK_DEVICES[0]?.deviceId ?? null),
                    }));

                    setHealth((prev) => ({
                        ...prev,
                        mic: "ok",
                        level: "warn",
                    }));
                }, 600);
            },

            selectMicDevice: (deviceId) => {
                setMic((prev) => ({ ...prev, selectedDeviceId: deviceId }));
            },

            startLevelMonitor: () => {
                if (levelTimerRef.current) return;

                levelTimerRef.current = window.setInterval(() => {
                    const r = Math.random();
                    const nextLevel = r < 0.08 ? 0 : Math.floor(Math.random() * 80);

                    setMic((prevMic) => ({ ...prevMic, level: nextLevel }));

                    setHealth((prevHealth) => {
                        const nextLevelHealth =
                            nextLevel >= 15 ? "ok" : nextLevel > 0 ? "warn" : "fail";
                        return { ...prevHealth, level: nextLevelHealth };
                    });
                }, 200);
            },

            stopLevelMonitor: () => {
                stopLevelMonitorImpl();
            },

            reset: () => {
                stopLevelMonitorImpl();

                setInputSource("screen");
                setVoiceId("AI 보이스 1");
                setMic({
                    permission: "idle",
                    selectedDeviceId: null,
                    level: 0,
                    lastError: null,
                });
                setHealth({
                    mic: "unknown",
                    level: "unknown",
                    network: "unknown",
                    ai: "unknown",
                });
            },

            goNext: () => {
                onNext?.();
            },
        };
    }, [onNext]);

    const canProceed = mic.permission === "granted";

    return {
        inputSource,
        voiceId,
        devices,
        mic,
        health,
        canProceed,
        actions,
    };
}
