import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

export type MicPermissionState = "idle" | "requesting" | "granted" | "denied" | "error";

export interface AudioDevice {
    deviceId: string;
    label: string;
}

interface DeviceContextType {
    permission: MicPermissionState;
    selectedDeviceId: string | null;
    devices: AudioDevice[];
    lastError: { code: string; message: string } | null;
    actions: {
        requestPermission: () => Promise<void>;
        selectDevice: (deviceId: string) => void;
        reset: () => void;
    };
}

const DeviceContext = createContext<DeviceContextType | null>(null);

export function DeviceContextProvider({ children }: { children: React.ReactNode }) {
    const [permission, setPermission] = useState<MicPermissionState>("idle");
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
    const [devices, setDevices] = useState<AudioDevice[]>([]);
    const [lastError, setLastError] = useState<{ code: string; message: string } | null>(null);

    const requestPermission = useCallback(async (isAutoRestore: boolean = false) => {
        // 이미 권한이 있으면 다시 요청하지 않고 확인만 수행 (장치 목록 갱신)
        if (permission === 'granted' && devices.length > 0) {
            return;
        }

        // 자동 복구가 아니고, 직접 요청하는 경우라면 플래그 설정
        if (!isAutoRestore) {
            sessionStorage.setItem('MIC_GRANTED_IN_SESSION', 'true');
        }

        setPermission("requesting");
        setLastError(null);

        try {
            // 1. 권한 요청 (스트림 열기)
            // 이미 권한이 있는 상태라면 브라우저가 프롬프트 없이 즉시 스트림을 반환함
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

            // 3. 스트림 일단 닫기 (단순 권한/목록 확보용)
            // 실제 사용은 각 페이지/컴포넌트에서 selectedDeviceId로 다시 getStream 함
            stream.getTracks().forEach(t => t.stop());

            setPermission("granted");

            // 기존 선택된 기기가 목록에 없으면(혹은 null이면) 첫번째 기기로 설정
            setSelectedDeviceId((prev) => {
                if (prev && audioInputs.find(d => d.deviceId === prev)) {
                    return prev;
                }
                return audioInputs[0]?.deviceId || "default";
            });

        } catch (err: any) {
            console.error("Mic permission error:", err);
            setPermission("denied");
            setLastError({ code: "PERMISSION_DENIED", message: err.message });
            // 실패 시 플래그 제거 (선택사항 - 실패해도 계속 시도하게 둘 지 결정. 여기선 제거)
            if (!isAutoRestore) {
                sessionStorage.removeItem('MIC_GRANTED_IN_SESSION');
            }
        }
    }, [devices.length, permission]);

    // [NEW] 새로고침 시 권한 복구 로직
    React.useEffect(() => {
        if (!navigator.permissions || !navigator.permissions.query) return;

        // 세션 내에서 명시적으로 권한을 받은 적이 있는지 확인
        const hasSessionAuth = sessionStorage.getItem('MIC_GRANTED_IN_SESSION') === 'true';
        if (!hasSessionAuth) return;

        navigator.permissions.query({ name: 'microphone' as PermissionName })
            .then((permissionStatus) => {
                if (permissionStatus.state === 'granted') {
                    requestPermission(true); // true = isAutoRestore
                }

                permissionStatus.onchange = () => {
                    if (permissionStatus.state === 'granted') {
                        // 권한이 외부에서 켜지면, 세션 플래그가 있을 때만 자동 연결
                        if (sessionStorage.getItem('MIC_GRANTED_IN_SESSION') === 'true') {
                            requestPermission(true);
                        }
                    } else {
                        setPermission(permissionStatus.state === 'denied' ? 'denied' : 'idle');
                        setDevices([]);
                        setSelectedDeviceId(null);
                    }
                };
            })
            .catch(err => console.warn("Permission query failed:", err));
    }, [requestPermission]);

    const selectDevice = useCallback((deviceId: string) => {
        setSelectedDeviceId(deviceId);
    }, []);

    const reset = useCallback(() => {
        setPermission("idle");
        setSelectedDeviceId(null);
        setDevices([]);
        setLastError(null);
    }, []);

    const value = useMemo(() => ({
        permission,
        selectedDeviceId,
        devices,
        lastError,
        actions: {
            requestPermission,
            selectDevice,
            reset
        }
    }), [permission, selectedDeviceId, devices, lastError, requestPermission, selectDevice, reset]);

    return (
        <DeviceContext.Provider value={value}>
            {children}
        </DeviceContext.Provider>
    );
}

export function useDeviceContext() {
    const context = useContext(DeviceContext);
    if (!context) {
        throw new Error("useDeviceContext must be used within a DeviceContextProvider");
    }
    return context;
}
