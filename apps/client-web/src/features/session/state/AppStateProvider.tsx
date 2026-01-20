import { useMemo, useReducer } from "react";
import type { ReactNode } from "react";
import { AppStateContext } from "./appState.context";
import { appStateReducer } from "./appState.reducer";
import { initialState } from "./appState.types";

export function AppStateProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appStateReducer, undefined, initialState);
    const value = useMemo(() => ({ state, dispatch }), [state]);
    return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}
