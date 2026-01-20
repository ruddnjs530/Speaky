import { useReducer } from "react";
import type { ReactNode } from "react";
import { AppStateStateContext, AppStateDispatchContext } from "./appState.context";
import { appStateReducer } from "./appState.reducer";
import { initialState } from "./appState.types";

export function AppStateProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appStateReducer, undefined, initialState);

    return (
        <AppStateDispatchContext.Provider value={dispatch}>
            <AppStateStateContext.Provider value={state}>
                {children}
            </AppStateStateContext.Provider>
        </AppStateDispatchContext.Provider>
    );
}
