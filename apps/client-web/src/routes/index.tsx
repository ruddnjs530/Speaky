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
import SessionProviderLayout from "../layouts/SessionProviderLayout.tsx";

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

                    {/* Provider는 precheck 포함: 상태/컨텍스트 공유 */}
                    <Route element={<SessionProviderLayout />}>
                        <Route path="/host/precheck" element={<HostPrecheckPage />} />

                        {/* Gate는 studio/viewer만: 단계 안내 UX 적용 */}
                        <Route element={<SessionLayout />}>
                            <Route path="/viewer/:roomId" element={<ViewerPage />} />
                            <Route path="/host/studio" element={<HostPage />} />
                        </Route>
                    </Route>
                </Route>


                {/* fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    );
}
