import { createContext, useContext } from "react";
import { type Api } from "./api";

/**
 * UX3 — the app's single `Api` is provided once at the top of the tree (above `RouterProvider`)
 * so route elements can pull it without prop-drilling through the router. View components still
 * accept `api` as a prop (so their unit tests render them directly with a fake), but the thin
 * route wrappers in `routes.tsx` and the persistent `AppShell` read it from here.
 */
const ApiContext = createContext<Api | null>(null);

export const ApiProvider = ApiContext.Provider;

export function useApi(): Api {
  const api = useContext(ApiContext);
  if (!api) throw new Error("useApi must be used within an <ApiProvider>");
  return api;
}
