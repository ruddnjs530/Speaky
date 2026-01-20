import { createContext } from "react";
import type { Dispatch } from "react";
import type { AppState } from "./appState.types";
import type { AppEvent } from "./appState.events";

export const AppStateStateContext = createContext<AppState | null>(null);
export const AppStateDispatchContext = createContext<Dispatch<AppEvent> | null>(null);
