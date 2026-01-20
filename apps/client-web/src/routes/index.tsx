import { Routes, Route, Navigate } from "react-router-dom";

import AppLayout from "../App";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import ProfilePage from "../pages/ProfilePage";

import ProtectedRoute from "./ProtectedRoute";
import HostPrecheckPage from "../pages/host/HostPrecheckPage";

import HostPage from "../pages/host/HostPage";
import ViewerPage from "../pages/viewer/ViewerPage";
import SessionLayout from "../layouts/SessionLayout.tsx";

export default function AppRoutes() {
    return (
        <Routes>
            {/* Vue의 App.vue + <router-view> 구조처럼: AppLayout 아래에 페이지를 둡니다 */}
            <Route element={<AppLayout />}>
                {/* Public */}
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />

                {/* Protected 영역 */}
                <Route element={<ProtectedRoute />}>
                    <Route path="/profile" element={<ProfilePage />} />

                    {/* Host, Viewer: 로그인 필수 */}
                    {/* 세션이 필요한 라우트만 AppStateProvider 적용 */}
                    <Route element={<SessionLayout />}>
                        <Route path="/viewer/:roomId" element={<ViewerPage />} />
                        <Route path="/host/precheck" element={<HostPrecheckPage />} />
                        <Route path="/host/studio" element={<HostPage />} />
                        {/* <Route path="/host/live" element={<HostLivePage />} /> */}
                    </Route>
                </Route>

                {/* fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    );
}
