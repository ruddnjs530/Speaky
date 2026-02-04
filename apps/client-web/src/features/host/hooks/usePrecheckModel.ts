import { useMemo, useRef, useState, useEffect } from "react";
import { voiceApi, type Voice } from "../api/voiceApi";
import { useDeviceContext } from "../providers/DeviceContext";

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

export function usePrecheckModel(opts?: { onNext?: (voiceId: number) => void }): PrecheckModel {
    const onNext = opts?.onNext;
    const onNextRef = useRef<((voiceId: number) => void) | undefined>(onNext);

    useEffect(() => {
        onNextRef.current = onNext;
    }, [onNext]);

    const [inputSource, setInputSource] = useState<InputSource>("screen");
    const [voiceId, setVoiceId] = useState<number>(1);
    const [voices, setVoices] = useState<Voice[]>([]);

    // Global Device Context
    const { permission, selectedDeviceId, devices, lastError, actions: deviceActions } = useDeviceContext();

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

    const [micLevel, setMicLevel] = useState(0);

    const [health, setHealth] = useState<HealthState>({
        mic: "unknown",
        level: "unknown",
        network: "unknown",
        ai: "unknown",
    });

    // Update health based on global permission state
    useEffect(() => {
        if (permission === 'granted') {
            setHealth(prev => ({ ...prev, mic: "ok" }));
        } else if (permission === 'denied' || permission === 'error') {
            setHealth(prev => ({ ...prev, mic: "fail" }));
        } else {
            setHealth(prev => ({ ...prev, mic: "unknown" }));
        }
    }, [permission]);

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

            setMicLevel(0);
            setHealth((prev) => ({ ...prev, level: "unknown" }));
        };

        const startLevelMonitorImpl = async () => {
            if (audioContextRef.current?.state === 'running') return;
            // selectedDeviceId가 없어도 permission이 있으면 default로 시도해볼 수도 있으나,
            // 여기선 안전하게 selectedDeviceId가 있을 때만 진행
            if (!selectedDeviceId) return;

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: { deviceId: { exact: selectedDeviceId } }
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

                    setMicLevel(normalizedLevel);
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
        };

        return {
            selectInputSource: (next) => setInputSource(next),
            selectVoice: (nextVoiceId) => setVoiceId(nextVoiceId),

            requestMicPermission: async () => {
                await deviceActions.requestPermission();
                // 권한 얻으면 자동 시작은 useEffect에서 처리
            },

            selectMicDevice: (deviceId) => {
                deviceActions.selectDevice(deviceId);
            },

            startLevelMonitor: startLevelMonitorImpl,

            stopLevelMonitor: () => {
                stopLevelMonitorImpl();
            },

            reset: () => {
                stopLevelMonitorImpl();
                setInputSource("screen");
                setVoiceId(1);
                deviceActions.reset();
                setHealth({
                    mic: "unknown",
                    level: "unknown",
                    network: "unknown",
                    ai: "unknown",
                });
            },

            goNext: () => {
                stopLevelMonitorImpl();
                onNextRef.current?.(voiceId);
            },
        };
    }, [selectedDeviceId, deviceActions, voiceId]); // actions 의존성 갱신

    useEffect(() => {
        return () => {
            actions.stopLevelMonitor();
        };
    }, [actions]);

    // [Refined] 권한이 승인되어 있고, 장치가 선택되면 자동으로 레벨 모니터링 시작
    // 페이지 진입 시 이미 권한이 있다면 즉시 시작됨
    useEffect(() => {
        if (permission === "granted" && selectedDeviceId) {
            // 약간의 딜레이를 주어 렌더링 안정화 후 시작
            const timer = setTimeout(() => {
                actions.startLevelMonitor();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [permission, selectedDeviceId, actions]);

    const canProceed = permission === "granted";

    // Re-construct mic object to match interface
    const mic: MicState = {
        permission,
        selectedDeviceId,
        level: micLevel,
        lastError
    };

    return {
        inputSource,
        voiceId,
        voices,
        devices,
        mic,
        health,
        canProceed,
        actions,
    };
}
