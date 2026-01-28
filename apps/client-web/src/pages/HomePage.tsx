import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

const isAuthed = () => Boolean(localStorage.getItem("accessToken"));
const TEST_ROOM_ID = "test"; // TODO(Day4): 검색/입력 UX로 대체

export default function HomePage() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(isAuthed());

  useEffect(() => {
    const sync = () => setAuthed(isAuthed());

    window.addEventListener("storage", sync);
    window.addEventListener("auth-change", sync as EventListener);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("auth-change", sync as EventListener);
    };
  }, []);

  const logout = () => {
    localStorage.removeItem("accessToken");
    window.dispatchEvent(new Event("auth-change"));
    setAuthed(false);
    navigate("/", { replace: true });
  };

  return (
    <div>
      <h1>Home</h1>

      <nav style={{ display: "flex", gap: 12 }}>
        {!authed ? (
          <>
            <Link to="/login">Login</Link>
            <Link to="/profile">Profile</Link>
          </>
        ) : (
          <>
            <Link to="/profile">Profile</Link>
            <button onClick={logout}>Logout</button>
            <Link to="/host/precheck">[DEV] Host Precheck</Link>

            {/* ✅ Viewer 라우트는 실제 roomId가 들어가야 합니다 */}
            <Link to={`/viewer/${TEST_ROOM_ID}`}>Viewer</Link>
          </>
        )}
      </nav>
    </div>
  );
}
