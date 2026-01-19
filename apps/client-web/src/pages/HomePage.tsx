import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

const isAuthed = () => Boolean(localStorage.getItem("accessToken"));

export default function HomePage() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(isAuthed());

  // 다른 페이지에서 login/logout 후 돌아왔을 때도 반영
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
    setAuthed(false);            // 현재 탭 즉시 반영
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
          </>
        )}
      </nav>
    </div>
  );
}
