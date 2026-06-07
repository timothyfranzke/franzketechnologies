const KEY = "franzke.vacation.v1";

function read() {
  if (typeof window === "undefined") return { trips: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { trips: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.trips)) return { trips: [] };
    return parsed;
  } catch {
    return { trips: [] };
  }
}

function write(state) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // quota exceeded or storage disabled — fail silently
  }
}

export function getTrips() {
  return read().trips.slice().sort((a, b) => {
    return new Date(b.lastOpenedAt || 0) - new Date(a.lastOpenedAt || 0);
  });
}

export function getTrip(code) {
  return read().trips.find((t) => t.code === code) ?? null;
}

export function upsertTrip(entry) {
  const state = read();
  const existing = state.trips.findIndex((t) => t.code === entry.code);
  const now = new Date().toISOString();
  const next = { ...entry, lastOpenedAt: entry.lastOpenedAt ?? now };
  if (existing >= 0) {
    state.trips[existing] = { ...state.trips[existing], ...next };
  } else {
    state.trips.push(next);
  }
  write(state);
  return next;
}

export function touchTrip(code) {
  const state = read();
  const idx = state.trips.findIndex((t) => t.code === code);
  if (idx < 0) return;
  state.trips[idx].lastOpenedAt = new Date().toISOString();
  write(state);
}

export function removeTrip(code) {
  const state = read();
  state.trips = state.trips.filter((t) => t.code !== code);
  write(state);
}
