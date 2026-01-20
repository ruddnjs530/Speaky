import { Outlet } from "react-router-dom";
import { AppStateProvider } from "../features/session/state/AppStateProvider";

export default function SessionLayout() {
    return (
        <AppStateProvider>
            <Outlet />
        </AppStateProvider>
    );
}
