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

export function usePrecheckModel(opts?: { onNext?: () => void }): PrecheckModel {
    const onNext = opts?.onNext;

    const [inputSource, setInputSource] = useState<InputSource>("screen");
    const [voiceId, setVoiceId] = useState<string>("AI 보이스 1");
    // 초기에는 빈 목록
    const [devices, setDevices] = useState<AudioDevice[]>([]);

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

    // 실제 오디오 분석을 위한 Refs
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    const actions = useMemo<PrecheckModel["actions"]>(() => {
        const stopLevelMonitorImpl = () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            if (sourceRef.current) {
                sourceRef.current.disconnect();
                sourceRef.current = null;
            }
            if (analyserRef.current) {
                analyserRef.current.disconnect();
                analyserRef.current = null;
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
            // AudioContext는 매번 닫거나, 재사용할 수 있음 (여기선 닫음)
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }

            setMic((prev) => ({ ...prev, level: 0 }));
            setHealth((prev) => ({ ...prev, level: "unknown" }));
        };

        return {
            selectInputSource: (next) => setInputSource(next),
            selectVoice: (nextVoiceId) => setVoiceId(nextVoiceId),

            requestMicPermission: async () => {
                setMic((prev) => ({ ...prev, permission: "requesting", lastError: null }));
                try {
                    // 1. 권한 요청 (스트림 열기)
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

                    // 2. 장치 목록 가져오기 (권한이 있어야 레이블이 보임)
                    const allDevices = await navigator.mediaDevices.enumerateDevices();
                    const audioInputs = allDevices
                        .filter(d => d.kind === 'audioinput')
                        .map(d => ({
                            deviceId: d.deviceId,
                            label: d.label || `마이크 ${d.deviceId.slice(0, 5)}...`
                        }));
                    setDevices(audioInputs);

                    // 3. 스트림 일단 닫기 (모니터링 시작 시 다시 엶)
                    stream.getTracks().forEach(t => t.stop());

                    setMic((prev) => ({
                        ...prev,
                        permission: "granted",
                        // 장치가 하나라도 있으면 첫 번째 것을 기본 선택
                        selectedDeviceId: prev.selectedDeviceId ?? (audioInputs[0]?.deviceId || "default")
                    }));
                    setHealth((prev) => ({ ...prev, mic: "ok" }));
                } catch (err: any) {
                    console.error("Mic permission error:", err);
                    setMic((prev) => ({
                        ...prev,
                        permission: "denied",
                        lastError: { code: "PERMISSION_DENIED", message: err.message }
                    }));
                    setHealth((prev) => ({ ...prev, mic: "fail" }));
                }
            },

            selectMicDevice: (deviceId) => {
                setMic((prev) => ({ ...prev, selectedDeviceId: deviceId }));
                // 장치가 변경되면 모니터링 재시작이 필요할 수 있으나,
                // 보통 AudioCheckCard 흐름상 사용자가 변경 후 다시 '확인'하거나
                // 자동으로 반응하게 하려면 여기서 stop -> start를 호출해야 함.
                // 일단은 상태만 변경. (스트림은 startLevelMonitor가 호출될 때 해당 ID 사용)

                // 만약 실시간 반영을 원한다면 아래 주석 해제:
                // stopLevelMonitorImpl(); 
                // actions.startLevelMonitor(); // (주의: 비동기/순환 참조 문제 가능성)
            },

            startLevelMonitor: async () => {
                // 이미 실행 중이면 중복 실행 방지 (단, 장치가 바뀌었을 수 있으므로 체크 필요)
                // 여기서는 간단히: 실행 중이면 일단 pass (stop 후 다시 해야 함)
                if (audioContextRef.current?.state === 'running') return;

                if (!mic.selectedDeviceId) return;

                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        audio: { deviceId: { exact: mic.selectedDeviceId } } // exact: ID 강제
                    });
                    streamRef.current = stream;

                    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                    audioContextRef.current = audioCtx;

                    const analyser = audioCtx.createAnalyser();
                    analyser.fftSize = 256;
                    analyserRef.current = analyser;

                    const source = audioCtx.createMediaStreamSource(stream);
                    sourceRef.current = source;
                    source.connect(analyser);

                    const dataArray = new Uint8Array(analyser.frequencyBinCount);

                    const updateLevel = () => {
                        if (!analyserRef.current) return;
                        analyserRef.current.getByteFrequencyData(dataArray);

                        let sum = 0;
                        for (let i = 0; i < dataArray.length; i++) {
                            sum += dataArray[i];
                        }
                        const average = sum / dataArray.length;

                        // 0~100으로 정규화 (보정값 적용)
                        const normalizedLevel = Math.min(100, Math.floor((average / 128) * 100 * 1.5));

                        setMic((prev) => ({ ...prev, level: normalizedLevel }));
                        setHealth((prev) => ({
                            ...prev,
                            level: normalizedLevel > 10 ? "ok" : normalizedLevel > 0 ? "warn" : "fail"
                        }));

                        animationFrameRef.current = requestAnimationFrame(updateLevel);
                    };

                    updateLevel();
                } catch (err) {
                    console.error("Failed to start level monitor", err);
                    // 특정 장치 실패 시 폴백(선택사항)이나 에러 표시
                    setHealth((prev) => ({ ...prev, mic: "fail", level: "fail" }));
                }
            },

            stopLevelMonitor: () => {
                stopLevelMonitorImpl();
            },

            reset: () => {
                stopLevelMonitorImpl();
                setInputSource("screen");
                setVoiceId("AI 보이스 1");
                setDevices([]); // 장치 목록 초기화
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
                stopLevelMonitorImpl();
                onNext?.();
            },
        };
    }, [onNext, mic.selectedDeviceId]);

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