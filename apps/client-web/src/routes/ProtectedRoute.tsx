import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getAccessToken } from "../shared/lib/authToken";

function isAuthed(): boolean {
  // 실제 토큰 존재 여부 확인
  return !!getAccessToken();
}

export default function ProtectedRoute() {
  const location = useLocation();

  if (!isAuthed()) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
}
