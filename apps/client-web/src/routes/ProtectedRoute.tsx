import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isTokenValid } from "../shared/lib/authToken";

function isAuthed(): boolean {
  // 토큰 유효성 검사 (존재 여부 + 만료 시간)
  return isTokenValid();
}

export default function ProtectedRoute() {
  const location = useLocation();

  if (!isAuthed()) {
    // pathname + search + hash 전체 경로 보존
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search + location.hash }} />;
  }

  return <Outlet />;
}
