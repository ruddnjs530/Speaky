import React from "react";
import { useAppStateValue, useAppDispatch } from "../state/useAppState";


export const ErrorPanel: React.FC = () => {
    const { kind, context } = useAppStateValue();
    const { lastError } = context;
    const dispatch = useAppDispatch();

    // 에러 상태가 아니거나 에러 정보가 없으면 렌더링 안 함
    if (kind !== "Error" || !lastError) return null;

    const { code, message } = lastError;

    // 액션 핸들러
    const handleRetry = () => dispatch({ type: "EV_RETRY" });
    const handleGoHome = () => {
        dispatch({ type: "EV_RESET" });
        window.location.href = "/"; // 홈으로 이동 (라우터 사용 시 navigate로 변경)
    };
    const handleLogin = () => {
        dispatch({ type: "EV_RESET" });
        window.location.href = "/login"; // 로그인으로 이동
    };
    const handleRefresh = () => {
        window.location.reload();
    };

    // 에러 코드별 컨텐츠 매핑
    const renderContent = (errCode: string) => {
        switch (errCode) {
            case "UNAUTHORIZED":
                return {
                    title: "인증이 만료되었습니다",
                    desc: "다시 로그인해주세요.",
                    action: <button onClick={handleLogin}>로그인 페이지로</button>,
                };
            case "INVALID_CLIENT_ID":
            case "INVALID_STATE":
                return {
                    title: "연결 상태 오류",
                    desc: "브라우저를 새로고침 해주세요.",
                    action: <button onClick={handleRefresh}>새로고침</button>,
                };
            case "SESSION_NOT_ACTIVE":
                return {
                    title: "방송이 종료되었습니다",
                    desc: message || "라이브 세션이 존재하지 않습니다.",
                    action: <button onClick={handleGoHome}>메인으로 나가기</button>,
                };
            case "DUPLICATE_HOST":
                return {
                    title: "중복 로그인이 감지됨",
                    desc: "다른 기기에서 방송이 시작되어 종료됩니다.",
                    action: <button onClick={handleGoHome}>확인</button>,
                };
            case "MEDIA_UNAVAILABLE":
                return {
                    title: "미디어 연결 실패",
                    desc: "서버와의 연결이 불안정합니다. 잠시 후 다시 시도해주세요.",
                    action: <button onClick={handleRetry}>다시 연결하기</button>,
                };
            case "RATE_LIMITED":
                return {
                    title: "요청이 너무 많습니다",
                    desc: "잠시 대기 후 다시 시도해주세요.",
                    action: <button onClick={handleRetry}>재시도</button>,
                };
            default:
                // REST_ERROR, UNKNOWN 등
                return {
                    title: "오류가 발생했습니다",
                    desc: message || "알 수 없는 오류입니다.",
                    action: (
                        <div style={{ display: "flex", gap: "8px" }}>
                            <button onClick={handleRetry}>재시도</button>
                            <button onClick={handleGoHome}>나가기</button>
                        </div>
                    ),
                };
        }
    };

    const content = renderContent(code);

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0,0,0,0.8)",
                color: "white",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
            }}
        >
            <div
                style={{
                    backgroundColor: "#333",
                    padding: "2rem",
                    borderRadius: "8px",
                    textAlign: "center",
                    maxWidth: "400px",
                    width: "90%",
                }}
            >
                <h2 style={{ marginBottom: "1rem", color: "#ff4444" }}>{content.title}</h2>
                <p style={{ marginBottom: "1.5rem", color: "#ccc" }}>{content.desc}</p>
                <div>{content.action}</div>

                {/* 디버그용 에러 코드 노출 (개발 중에만 유용) */}
                <div style={{ marginTop: "1rem", fontSize: "0.8rem", color: "#666" }}>
                    Code: {code}
                </div>
            </div>
        </div>
    );
};