import React from "react";
import { useAppStateValue } from "../state/useAppState";
import type { AppStateKind } from "../state/appState.types";

export const SessionStatusBadge: React.FC = () => {
    const { kind } = useAppStateValue();

    const getColor = (k: AppStateKind) => {
        switch (k) {
            case "Idle": return "#999";
            case "SessionReady": return "#2196F3"; // Blue
            case "WsConnecting": return "#FFC107"; // Amber
            case "Attached": return "#00BCD4";     // Cyan
            case "PcConnecting": return "#8BC34A"; // Light Green
            case "Connected": return "#4CAF50";    // Green
            case "Reconnecting": return "#FF9800"; // Orange
            case "Error": return "#F44336";        // Red
            default: return "#999";
        }
    };

    return (
        <div
            style={{
                position: "fixed",
                bottom: "16px",
                right: "16px",
                padding: "6px 12px",
                borderRadius: "20px",
                backgroundColor: getColor(kind),
                color: "white",
                fontSize: "12px",
                fontWeight: "bold",
                boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
                zIndex: 8000,
                transition: "background-color 0.3s",
            }}
        >
            ● {kind}
        </div>
    );
};