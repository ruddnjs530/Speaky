import { useNavigate } from "react-router-dom";

export default function ProfilePage() {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("accessToken");
    navigate("/", { replace: true });
  };

  return (
    <div>
      <h1>Profile</h1>
      <button onClick={logout}>Logout</button>
    </div>
  );
}