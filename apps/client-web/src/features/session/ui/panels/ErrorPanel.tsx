import {useAppDispatch, useAppStateValue} from "../../state/useAppState.ts";

export function ErrorPanel() {
    const state = useAppStateValue();
    const dispatch = useAppDispatch();

    const err = state.context.lastError;

    return (
        <div style={{ padding: 16 }}>
            <h2>Error</h2>
            <pre style={{ background: "#fff0f0", padding: 12 }}>
        {JSON.stringify(err, null, 2)}
      </pre>

            <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => dispatch({ type: "RETRY" })}>Retry</button>
                <button onClick={() => dispatch({ type: "RESET" })}>Reset</button>
            </div>
        </div>
    );
}
