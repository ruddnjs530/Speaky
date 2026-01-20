import { useAppStateValue } from "../state/useAppState";
import { IdlePanel } from "./panels/IdlePanel";
import { LoadingPanel } from "./panels/LoadingPanel";
import { ReadyPanel } from "./panels/ReadyPanel";
import { ErrorPanel } from "./panels/ErrorPanel";

export function SessionGate() {
    const state  = useAppStateValue();

    switch (state.kind) {
        case "Idle":
            return <IdlePanel />;

        case "SessionReady":
            return <ReadyPanel />;

        case "WsConnecting":
            return <LoadingPanel text="WsConnecting" />;

        case "Attached":
            return <LoadingPanel text="Attached" />;

        case "PcConnecting":
            return <LoadingPanel text="PcConnecting" />;

        case "Connected":
            return <LoadingPanel text="Connected" />;

        case "Reconnecting":
            return <LoadingPanel text="Reconnecting" />;

        case "Error":
            return <ErrorPanel />;

        default: {
            const _exhaustive: never = state;
            return _exhaustive;
        }
    }
}
