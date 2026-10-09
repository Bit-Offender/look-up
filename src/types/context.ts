import type { Phase } from "@/lib/world/sun";

export type AppContext = {
  latitude: number;
  longitude: number;

  sunsetInMinutes: number | null;
  sunsetBearing: number | null;

  moonPhase: number;

  rainLast6h: number;
  cloudCover: number;

  phase: Phase
};