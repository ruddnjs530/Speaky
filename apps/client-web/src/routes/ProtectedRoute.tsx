import { Navigate, Outlet, useLocation } from "react-router-dom";

function isAuthed(): boolean {
  // ✅ 백엔드 붙이기 전: devAuth로만 체크
  return localStorage.getItem("devAuth") === "1";
}

export default function ProtectedRoute() {
  const location = useLocation();

  if (!isAuthed()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
