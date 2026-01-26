import React, { useEffect, useState } from "react";
import { useAppDispatch } from "../state/useAppState";
import type { SysErrorCode } from "../state/appState.types";

export const DevTools: React.FC = () => {
    const dispatch = useAppDispatch();
    const [isOpen, setIsOpen] = useState(false);

    // 1. URL 쿼리 파라미터로 초기 상태 주입 (Scenario Switch)
    // 예: http://localhost:3000?devState=Error&code=UNAUTHORIZED
    useEffect(() => {
        if (import.meta.env.PROD) return;

        const params = new URLSearchParams(window.location.search);
        const devState = params.get("devState");
        const code = params.get("code") as SysErrorCode;

        if (devState === "Error" && code) {
            dispatch({
                type: "EV_ERROR",
                error: { code, message: "DevTools Forced Error" },
            });
        }
    }, [dispatch]);

    if (import.meta.env.PROD) return null;

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    position: "fixed",
                    bottom: "16px",
                    left: "16px",
                    zIndex: 9999,
                    padding: "8px",
                    opacity: 0.5,
                }}
            >
                🛠️
            </button>
        );
    }

    return (
        <div
            style={{
                position: "fixed",
                bottom: "16px",
                left: "16px",
                width: "300px",
                backgroundColor: "rgba(0,0,0,0.9)",
                color: "#0f0",
                padding: "16px",
                borderRadius: "8px",
                zIndex: 9999,
                fontFamily: "monospace",
                fontSize: "12px",
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <strong>DevTools (State Injector)</strong>
                <button onClick={() => setIsOpen(false)}>X</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <button onClick={() => dispatch({ type: "EV_WS_CONNECTING" })}>
                    Trigger: WS Connecting
                </button>
                <button onClick={() => dispatch({ type: "EV_ATTACHED_OK" })}>
                    Trigger: Attached (ACK)
                </button>
                <button onClick={() => dispatch({ type: "EV_PC_CONNECTED" })}>
                    Trigger: PC Connected
                </button>
                <button onClick={() => dispatch({ type: "EV_RETRY" })}>
                    Trigger: Retry
                </button>
                <hr style={{ width: "100%", borderColor: "#333" }} />

                <strong>Force Errors:</strong>
                <button onClick={() => dispatch({ type: "EV_ERROR", error: { code: "UNAUTHORIZED", message: "Token Expired" } })}>
                    Error: UNAUTHORIZED
                </button>
                <button onClick={() => dispatch({ type: "EV_ERROR", error: { code: "SESSION_NOT_ACTIVE", message: "Live Ended" } })}>
                    Error: SESSION_NOT_ACTIVE
                </button>
                <button onClick={() => dispatch({ type: "EV_ERROR", error: { code: "DUPLICATE_HOST", message: "Another Login" } })}>
                    Error: DUPLICATE_HOST
                </button>
            </div>
        </div>
    );
};