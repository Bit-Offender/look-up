import { useSyncExternalStore } from "react";

/**
 * The mission the user is currently out on. MissionCard saves it when they start,
 * /away reads it for the countdown, and /journal/new reads it to label the entry.
 */
export type ActiveMission = {
  id: string; // Mission.id
  title: string; // Mission.title
  text: string; // instruction with {placeholders} already filled
  minutes: number; // Mission.min
};

export const ACTIVE_MISSION_KEY = "lookup:activeMission";

export const DEFAULT_MISSION: ActiveMission = {
  id: "freeform",
  title: "Outing",
  text: "Go outside and look up.",
  minutes: 10,
};

export function saveActiveMission(m: ActiveMission) {
  try {
    localStorage.setItem(ACTIVE_MISSION_KEY, JSON.stringify(m));
  } catch {}
}

function parse(raw: string | null): ActiveMission {
  try {
    if (raw) {
      const m = JSON.parse(raw);
      if (typeof m?.text === "string") {
        return {
          id: typeof m.id === "string" && m.id ? m.id : DEFAULT_MISSION.id,
          title: typeof m.title === "string" && m.title ? m.title : DEFAULT_MISSION.title,
          text: m.text,
          minutes: Number(m.minutes) > 0 ? Number(m.minutes) : DEFAULT_MISSION.minutes,
        };
      }
    }
  } catch {}
  return DEFAULT_MISSION;
}

// localStorage as an external store. The snapshot must be referentially stable,
// so we only re-parse when the raw string changes.
let cachedRaw: string | null | undefined;
let cached = DEFAULT_MISSION;

function getSnapshot(): ActiveMission {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(ACTIVE_MISSION_KEY);
  } catch {}
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parse(raw);
  }
  return cached;
}

const getServerSnapshot = () => DEFAULT_MISSION; // SSR + hydration: no localStorage

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

export function useActiveMission(): ActiveMission {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
