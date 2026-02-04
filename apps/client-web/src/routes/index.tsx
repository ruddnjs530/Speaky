import { createBrowserRouter, Navigate } from "react-router-dom";

import AppLayout from "../App";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";
import ProfilePage from "../pages/ProfilePage";

import ProtectedRoute from "./ProtectedRoute";
import HostPrecheckPage from "../pages/host/HostPrecheckPage";

import HostPage from "../pages/host/HostPage";
import ViewerPage from "../pages/viewer/ViewerPage";
import ViewerEntryPage from "../pages/viewer/ViewerEntryPage";
import SessionLayout from "../layouts/SessionLayout.tsx";
import SessionProviderLayout from "../layouts/SessionProviderLayout.tsx";
import IntroPage from "../pages/IntroPage";

const router = createBrowserRouter([
    {
        element: <AppLayout />,
        children: [
            // Public
            { path: "/", element: <IntroPage /> },
            { path: "/start", element: <HomePage /> },
            { path: "/login", element: <LoginPage /> },
            { path: "/signup", element: <SignupPage /> },

            // Protected 영역
            {
                element: <ProtectedRoute />,
                children: [
                    { path: "/profile", element: <ProfilePage /> },

                    // Provider는 precheck 포함: 상태/컨텍스트 공유
                    {
                        element: <SessionProviderLayout />,
                        children: [
                            { path: "/host/precheck", element: <HostPrecheckPage /> },

                            // Gate는 studio/viewer만: 단계 안내 UX 적용
                            {
                                element: <SessionLayout />,
                                children: [
                                    { path: "/host/studio", element: <HostPage /> },
                                    { path: "/viewer/entry", element: <ViewerEntryPage /> },
                                    { path: "/viewer/:roomId", element: <ViewerPage /> },
                                ]
                            }
                        ]
                    },
                    // fallback
                    { path: "*", element: <Navigate to="/" replace /> }
                ]
            }
        ]
    }
]);

export default router;
