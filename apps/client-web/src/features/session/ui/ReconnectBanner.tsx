import React from "react";
import { useAppStateValue } from "../state/useAppState";

export const ReconnectBanner: React.FC = () => {
    const { kind } = useAppStateValue();

    // Reconnecting 상태일 때만 표시
    if (kind !== "Reconnecting") return null;

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                backgroundColor: "#ff9800", // 경고색 (주황)
                color: "white",
                padding: "0.5rem",
                textAlign: "center",
                zIndex: 9000,
                fontWeight: "bold",
                boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            }}
        >
            📡 네트워크 연결이 불안정하여 재연결 중입니다...
        </div>
    );
};