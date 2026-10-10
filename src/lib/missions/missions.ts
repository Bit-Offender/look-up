import type { Phase } from "../world/sun";
import type { SkyCondition } from "../world/weather";
import data from "./missions.generated.json";

export type Mission = {
  id: string;
  title: string;
  time: (Phase | "any")[];
  sky: (SkyCondition | "any")[];
  instruction: string; // may contain {placeholders} from FACT_KEYS
  min: number;
  needs?: "moon";
};

export const missions = data as Mission[];
