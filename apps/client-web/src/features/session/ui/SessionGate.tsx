import type { ReactNode } from "react";
import { useAppStateValue } from "../state/useAppState";
import { IdlePanel } from "./panels/IdlePanel";
import { LoadingPanel } from "./panels/LoadingPanel";
import { ReadyPanel } from "./panels/ReadyPanel";
import { ErrorPanel } from "./panels/ErrorPanel";

import "./SessionGate.css";

export function SessionGate({ children }: { children: ReactNode }) {
    const state = useAppStateValue();

    const showIdle = state.kind === "Idle";
    const showReady = state.kind === "SessionReady";
    const showLoading =
        state.kind === "WsConnecting" ||
        state.kind === "Attached" ||
        state.kind === "PcConnecting" ||
        state.kind === "Reconnecting";
    const showError = state.kind === "Error";

    const shouldShowOverlay = showIdle || showReady || showLoading || showError;

    return (
        <>
            {/* 실제 페이지는 항상 렌더링 */}
            {children}

            {/* 상태 안내 오버레이 */}
            {shouldShowOverlay && (
                <div className="sessionGateOverlay">
                    <div className="sessionGatePanel">
                        {showIdle && <IdlePanel />}
                        {showReady && <ReadyPanel />}
                        {showLoading && <LoadingPanel />}
                        {showError && <ErrorPanel />}
                    </div>
                </div>
            )}
        </>
    );
}
