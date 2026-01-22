import { Outlet } from "react-router-dom";
import {SessionGate} from "../features/session/ui/SessionGate.tsx";

export default function SessionLayout() {
    return (
        <SessionGate>
            <Outlet />
        </SessionGate>
    );
}
