import { useContext } from "react";
import { AppStateStateContext, AppStateDispatchContext } from "./appState.context";

export function useAppStateValue() {
    const state = useContext(AppStateStateContext);
    if (!state) throw new Error("useAppStateValue must be used within AppStateProvider");
    return state;
}

export function useAppDispatch() {
    const dispatch = useContext(AppStateDispatchContext);
    if (!dispatch) throw new Error("useAppDispatch must be used within AppStateProvider");
    return dispatch;
}

/**
 * @deprecated
 * use useAppStateValue() or useAppDispatch() instead.
 * This function is kept temporarily for backward compatibility.
 */
export function useAppState() {
    return {
        state: useAppStateValue(),
        dispatch: useAppDispatch(),
    };
}

