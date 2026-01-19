import { useLocation, useNavigate } from "react-router-dom";
import LoginForm from "../features/auth/api/LoginForm";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname ?? "/";

  const handleSuccess = () => {
    // ✅ 백엔드 전: devAuth 플래그만 세팅
    localStorage.setItem("devAuth", "1");

    // ✅ 원래 가려던 곳으로 복귀
    navigate(from, { replace: true });
  };

  return (
      <div className="page page--center">
        <LoginForm onSuccess={handleSuccess} />
      </div>
  );
}
