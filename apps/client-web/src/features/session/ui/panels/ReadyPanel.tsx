import {useAppDispatch, useAppStateValue} from "../../state/useAppState.ts";

export function ReadyPanel() {
    const state = useAppStateValue();
    const dispatch = useAppDispatch();

    return (
        <div style={{ padding: 16 }}>
            <h2>SessionReady</h2>
            <pre style={{ background: "#f5f5f5", padding: 12 }}>
        {JSON.stringify(state.context, null, 2)}
      </pre>

            <button
                onClick={() => dispatch({ type: "WS_CONNECT_START" })}
                style={{ marginTop: 8 }}
            >
                (Day2) WS 연결 시작
            </button>
        </div>
    );
}
