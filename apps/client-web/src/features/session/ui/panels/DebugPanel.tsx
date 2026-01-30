// src/features/session/ui/panels/DebugPanel.tsx
import { useEffect, useMemo, useState } from "react";
import { signalingTrace, type TraceItem } from "../../../../shared/lib/signaling/trace";
import "./DebugPanel.css";

function formatTime(ms: number) {
    const d = new Date(ms);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    const mmm = String(d.getMilliseconds()).padStart(3, "0");
    return `${hh}:${mm}:${ss}.${mmm}`;
}

export function DebugPanel() {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<TraceItem[]>([]);
    const [typeFilter, setTypeFilter] = useState("");
    const [requestIdFilter, setRequestIdFilter] = useState("");

    useEffect(() => signalingTrace.subscribe(setItems), []);

    const filtered = useMemo(() => {
        const tf = typeFilter.trim();
        const rf = requestIdFilter.trim();
        return items.filter((it) => {
            if (tf && !it.type.includes(tf)) return false;
            if (rf && !(it.requestId ?? "").includes(rf)) return false;
            return true;
        });
    }, [items, typeFilter, requestIdFilter]);

    if (!import.meta.env.DEV) return null;

    return (
        <div className="dbgRoot">
            <button className="dbgFab" onClick={() => setOpen((v) => !v)}>
                Debug
            </button>

            {open && (
                <div className="dbgPanel">
                    <div className="dbgHeader">
                        <div className="dbgTitle">Signaling Trace</div>
                        <div className="dbgActions">
                            <button
                                className="dbgBtn"
                                style={{ color: "#fa0" }}
                                onClick={() => {
                                    if (localStorage.getItem("accessToken")) {
                                        localStorage.removeItem("accessToken");
                                        console.log("[DevTools] Logout");
                                    } else {
                                        localStorage.setItem("accessToken", "dev-token-" + Date.now());
                                        console.log("[DevTools] Login (Dev)");
                                    }
                                    window.dispatchEvent(new Event("auth-change"));
                                    window.dispatchEvent(new Event("storage"));
                                }}
                            >
                                DevAuth
                            </button>
                            <button
                                className="dbgBtn"
                                onClick={() => {
                                    setTypeFilter("SYS_ERROR");
                                    setRequestIdFilter("");
                                }}
                                title="SYS_ERROR만 보기"
                            >
                                Errors only
                            </button>

                            <button
                                className="dbgBtn"
                                onClick={() => {
                                    setTypeFilter("WS_");
                                    setRequestIdFilter("");
                                }}
                                title="WS 라이프사이클만 보기"
                            >
                                WS only
                            </button>

                            <button
                                className="dbgBtn"
                                onClick={() => {
                                    setTypeFilter("");
                                    setRequestIdFilter("");
                                }}
                                title="필터 초기화"
                            >
                                Reset
                            </button>

                            <button className="dbgBtn" onClick={() => signalingTrace.clear()}>
                                Clear
                            </button>

                            <button className="dbgBtn" onClick={() => setOpen(false)}>
                                Close
                            </button>
                        </div>

                    </div>

                    <div className="dbgFilters">
                        <label className="dbgLabel">
                            type
                            <input
                                className="dbgInput"
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                placeholder="e.g. SIG_ICE / SYS_ERROR / WS_"
                            />
                        </label>

                        <label className="dbgLabel">
                            requestId
                            <input
                                className="dbgInput"
                                value={requestIdFilter}
                                onChange={(e) => setRequestIdFilter(e.target.value)}
                                placeholder="uuid contains..."
                            />
                        </label>
                    </div>

                    <div className="dbgList">
                        {filtered.map((it) => (
                            <div key={it.id} className={`dbgRow dbg_${it.dir}`}>
                                <div className="dbgMeta">
                                    <span className="dbgTime">{formatTime(it.at)}</span>
                                    <span className="dbgDir">{it.dir.toUpperCase()}</span>
                                    <span className="dbgType">{it.type}</span>
                                </div>

                                <div className="dbgInfo">
                                    {it.requestId && <span className="dbgChip">req: {it.requestId}</span>}
                                    {it.channelId && <span className="dbgChip">ch: {it.channelId}</span>}
                                    {it.sessionId && <span className="dbgChip">sess: {it.sessionId}</span>}
                                    {(it.fromRole || it.fromClientId) && (
                                        <span className="dbgChip">
                                            from: {it.fromRole ?? "?"}/{it.fromClientId ?? "?"}
                                        </span>
                                    )}
                                    {it.summary && <span className="dbgSummary">{it.summary}</span>}
                                </div>
                            </div>
                        ))}

                        {!filtered.length && <div className="dbgEmpty">No logs.</div>}
                    </div>
                </div>
            )}
        </div>
    );
}
