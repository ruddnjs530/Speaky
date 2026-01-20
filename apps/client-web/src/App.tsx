import { Outlet } from "react-router-dom";
import "./App.css";
import { AppStateProvider } from "./features/session/state/AppStateProvider";

export default function AppLayout() {
    return (
        <AppStateProvider>
            <div className="appLayout">
                {/* 필요하면 여기에 Header/Nav를 넣으시면 됩니다 */}
                <Outlet />
                {/* 필요하면 Footer */}
            </div>
        </AppStateProvider>
    );
}
