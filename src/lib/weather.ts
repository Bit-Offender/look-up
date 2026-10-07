export type SkyCondition = "clear" | "cloudy" | "rain";

export async function getWeather(lat: number, lng: number) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=cloud_cover,precipitation&hourly=precipitation&past_hours=6&forecast_hours=1`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("Weather request failed");
  }

  const data = await res.json();

  const rainLast6h = (data.hourly.precipitation as number[])
    .reduce((a, b) => a + b, 0);

  const cloudCover = data.current.cloud_cover as number;
  const currentPrecipitation = data.current.precipitation as number;

  let sky: SkyCondition;

  if (currentPrecipitation > 0) {
    sky = "rain";
  } else if (cloudCover >= 60) {
    sky = "cloudy";
  } else {
    sky = "clear";
  }

  return {
    rainLast6h,
    cloudCover,
    sky,
  };
}