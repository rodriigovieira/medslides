const CLIENT_ID_KEY = "medslides.clientId";

/**
 * Anonymous per-browser id. It's the key for "minhas apresentações" and for the
 * per-browser daily quota — it identifies a browser, not a person, and a
 * determined user can reset it. The global daily cap is the real spend guard.
 */
export function getClientId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(CLIENT_ID_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(CLIENT_ID_KEY, created);
    return created;
  } catch {
    return "";
  }
}

/**
 * `useSyncExternalStore` plumbing. The id never changes after first read, so
 * subscribing is a no-op — this exists only to read localStorage on the client
 * without an effect and without a hydration mismatch.
 */
export function subscribeToClientId() {
  return () => {};
}

export const clientIdSnapshot = getClientId;
export const clientIdServerSnapshot = () => "";
