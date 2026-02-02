import { useMemo, useRef, useState, useEffect } from "react";
import { voiceApi, type Voice } from "../api/voiceApi";

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
    network: "ok" | "warn" | "fail" | "unknown";
    ai: "ok" | "warn" | "fail" | "unknown";
}

export interface PrecheckModel {
    inputSource: InputSource;
    voiceId: number; // Changed to number
    voices: Voice[]; // Added voices list
    devices: AudioDevice[];
    mic: MicState;
    health: HealthState;
    canProceed: boolean;
    actions: {
        selectInputSource: (next: InputSource) => void;
        selectVoice: (voiceId: number) => void;
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
    const onNextRef = useRef(onNext);

    useEffect(() => {
        onNextRef.current = onNext;
    }, [onNext]);

    const [inputSource, setInputSource] = useState<InputSource>("screen");
    const [voiceId, setVoiceId] = useState<number>(1); // Default to ID 1
    const [voices, setVoices] = useState<Voice[]>([]);



    // Voices Fetching
    useEffect(() => {
        voiceApi.getVoices()
            .then(data => {
                setVoices(data);
                if (data.length > 0) {
                    setVoiceId(data[0].id);
                }
            })
            .catch(err => console.error("Failed to load voices", err));
    }, []);

    // [NEW] Network & AI 상태 체크
    useEffect(() => {
        // 1. AI 체크: 보이스 목록이 있으면 OK
        if (voices.length > 0) {
            setHealth(prev => ({ ...prev, ai: "ok" }));
        }

        // 2. Network 체크
        const updateNetwork = () => {
            setHealth(prev => ({
                ...prev,
                network: navigator.onLine ? "ok" : "fail"
            }));
        };

        window.addEventListener('online', updateNetwork);
        window.addEventListener('offline', updateNetwork);
        updateNetwork();

        return () => {
            window.removeEventListener('online', updateNetwork);
            window.removeEventListener('offline', updateNetwork);
        };
    }, [voices]);

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
            },

            startLevelMonitor: async () => {
                if (audioContextRef.current?.state === 'running') return;
                if (!mic.selectedDeviceId) return;

                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        audio: { deviceId: { exact: mic.selectedDeviceId } }
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

                        // 0~100으로 정규화
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
                    setHealth((prev) => ({ ...prev, mic: "fail", level: "fail" }));
                }
            },

            stopLevelMonitor: () => {
                stopLevelMonitorImpl();
            },

            reset: () => {
                stopLevelMonitorImpl();
                setInputSource("screen");
                setVoiceId(1); // Reset to ID 1
                setDevices([]);
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
                onNextRef.current?.();
            },
        };
    }, [mic.selectedDeviceId]);

    useEffect(() => {
        return () => {
            actions.stopLevelMonitor();
        };
    }, [actions]);

    // [NEW] 권한이 승인되면 자동으로 레벨 모니터링 시작
    useEffect(() => {
        if (mic.permission === "granted" && mic.selectedDeviceId) {
            const timer = setTimeout(() => {
                actions.startLevelMonitor();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [mic.permission, mic.selectedDeviceId, actions]); // actions 의존성 추가

    const canProceed = mic.permission === "granted";

    return {
        inputSource,
        voiceId,
        voices, // Return voices
        devices,
        mic,
        health,
        canProceed,
        actions,
    };
}
