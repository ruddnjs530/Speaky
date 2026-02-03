import { Outlet } from "react-router-dom";
import "./App.css";
import { DebugPanel } from "./features/session/ui/panels/DebugPanel.tsx";
import { DeviceContextProvider } from "./features/host/providers/DeviceContext.tsx";

export default function AppLayout() {
    return (
        <DeviceContextProvider>
            <div className="appLayout">
                {/* 필요하면 여기에 Header/Nav를 넣으시면 됩니다 */}
                <Outlet />
                {/* 필요하면 Footer */}

                {import.meta.env.DEV && <DebugPanel />}
            </div>
        </DeviceContextProvider>
    );
}
