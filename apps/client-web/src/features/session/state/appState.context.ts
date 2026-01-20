import { createContext } from "react";
import type { Dispatch } from "react";
import type { AppState } from "./appState.types";
import type { AppEvent } from "./appState.events";

export type AppStateStore = {
    state: AppState;
    dispatch: Dispatch<AppEvent>;
};

export const AppStateContext = createContext<AppStateStore | null>(null);
