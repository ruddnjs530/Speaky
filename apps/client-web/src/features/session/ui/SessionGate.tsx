import type { ReactNode } from "react";
import { useAppStateValue } from "../state/useAppState";
import { IdlePanel } from "./panels/IdlePanel";
import { LoadingPanel } from "./panels/LoadingPanel";
import { ReadyPanel } from "./panels/ReadyPanel";
import { ErrorPanel } from "./panels/ErrorPanel";

import "./SessionGate.css";

export function SessionGate({ children }: { children: ReactNode }) {
    const state = useAppStateValue();

    const isDev = import.meta.env.DEV;

    const showIdle = state.kind === "Idle";
    const showReady = state.kind === "SessionReady";
    const showLoading =
        state.kind === "WsConnecting" ||
        state.kind === "Attached" ||
        state.kind === "PcConnecting" ||
        state.kind === "Reconnecting";
    const showError = state.kind === "Error";

    // ✅ IdlePanel은 개발 전용으로만 허용
    const shouldShowOverlay =
        (isDev && showIdle) || showReady || showLoading || showError;

    return (
        <>
            {children}

            {shouldShowOverlay && (
                <div className="sessionGateOverlay">
                    <div className="sessionGatePanel">
                        {isDev && showIdle && <IdlePanel />}
                        {showReady && <ReadyPanel />}
                        {showLoading && <LoadingPanel />}
                        {showError && <ErrorPanel />}
                    </div>
                </div>
            )}
        </>
    );
}
