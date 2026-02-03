import { useNavigate } from "react-router-dom";

export default function ProfilePage() {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("accessToken");
    sessionStorage.removeItem("MIC_GRANTED_IN_SESSION"); // 로그아웃 시 권한 세션 기록 삭제
    navigate("/", { replace: true });
  };

  return (
    <div>
      <h1>Profile</h1>
      <button onClick={logout}>Logout</button>
    </div>
  );
}