import type { ReactNode } from "react";
import { useAppStateValue } from "../state/useAppState";
import { IdlePanel } from "./panels/IdlePanel";
import { LoadingPanel } from "./panels/LoadingPanel";
import { ReadyPanel } from "./panels/ReadyPanel";
import { ErrorPanel } from "./panels/ErrorPanel";
import { DebugPanel } from "./panels/DebugPanel";

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
    // IdlePanel은 이제 Floating(toggle)으로 변경되었으므로 overlay에 포함하지 않음.
    const shouldShowOverlay = showReady || showLoading || showError;

    return (
        <>
            {children}

            {shouldShowOverlay && (
                <div className="sessionGateOverlay">
                    <div className="sessionGatePanel">
                        {showReady && <ReadyPanel />}
                        {showLoading && <LoadingPanel />}
                        {showError && <ErrorPanel />}
                    </div>
                </div>
            )}

            {/* 항상 떠있고 토글 가능한 IdlePanel */}
            {isDev && showIdle && <IdlePanel />}
            {isDev && <DebugPanel />}{/* ✅ 추가 */}
        </>
    );
}
