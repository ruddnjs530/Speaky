import { Outlet } from "react-router-dom";
import { AppStateProvider } from "../features/session/state/AppStateProvider";

export default function SessionProviderLayout() {
    return (
        <AppStateProvider>
            <Outlet />
        </AppStateProvider>
    );
}
