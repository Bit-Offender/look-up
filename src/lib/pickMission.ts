import type { AppContext } from "@/types/context";

import { missions, type Mission } from "./missions";

import { getPhase, getSunInfo } from "./sun";

import { getWeather } from "./weather";

export async function pickMission(
  context: AppContext
): Promise<Mission> {
  const sunInfo = getSunInfo(
    context.latitude,
    context.longitude
  );

  const time = getPhase(sunInfo.sunsetInMinutes);

  const weather = await getWeather(
    context.latitude,
    context.longitude
  );

  const sky = weather.sky;

  const matchingMissions = missions.filter((mission) => {
    const timeMatches =
      mission.time.includes("any") ||
      mission.time.includes(time);

    const skyMatches =
      mission.sky.includes("any") ||
      mission.sky.includes(sky);

    return timeMatches && skyMatches;
  });

  if (matchingMissions.length === 0) {
    return missions.find(
      (mission) => mission.id === "far-point"
    )!;
  }

  const randomIndex = Math.floor(
    Math.random() * matchingMissions.length
  );

  return matchingMissions[randomIndex];
}

