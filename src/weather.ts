import type { TimeOfDay } from "./config.js";
import { debug } from "./logger.js";

export interface HourlyForecast {
  hour: number;
  pop: number; // 0-100 percentage
  rainMm: number;
  snowMm: number;
  ice: boolean; // freezing rain or verglas risk
  description: string;
  icon: string;
  temp: number;
}

export interface RouteForecast {
  departureHours: HourlyForecast[];
  arrivalHours: HourlyForecast[];
  avgMaxPop: number;
  avgTemp: number;
  description: string;
  icon: string;
  hasSnow: boolean;
  hasIce: boolean;
}

export interface DailySummary {
  avgTemp: number;
  pop: number; // 0-100
  description: string;
  icon: string;
}

interface OWMHourly {
  dt: number;
  temp: number;
  pop: number;
  weather: { id: number; description: string; icon: string }[];
  rain?: { "1h": number };
  snow?: { "1h": number };
}

interface OWMDaily {
  dt: number;
  temp: { day: number; min: number; max: number };
  pop: number;
  weather: { description: string; icon: string }[];
}

interface OWMResponse {
  hourly: OWMHourly[];
  daily?: OWMDaily[];
}

function weatherEmoji(icon: string): string {
  // OWM icon codes: https://openweathermap.org/weather-conditions
  if (icon.startsWith("01")) return "☀️";
  if (icon.startsWith("02")) return "🌤️";
  if (icon.startsWith("03")) return "☁️";
  if (icon.startsWith("04")) return "☁️";
  if (icon.startsWith("09")) return "🌧️";
  if (icon.startsWith("10")) return "🌦️";
  if (icon.startsWith("11")) return "⛈️";
  if (icon.startsWith("13")) return "❄️";
  if (icon.startsWith("50")) return "🌫️";
  return "🌡️";
}

function timeToMinutes(t: TimeOfDay): number {
  return t.hour * 60 + t.minute;
}

async function fetchLocationForecast(
  lat: number,
  lon: number,
  apiKey: string,
  from: TimeOfDay,
  to: TimeOfDay,
): Promise<HourlyForecast[]> {
  const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=current,minutely,daily,alerts&units=metric&lang=fr&appid=${apiKey}`;

  debug("Fetching weather", { lat, lon, from, to });

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OWM API error ${res.status}: ${body}`);
  }

  const data: OWMResponse = await res.json();

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const tomorrowStart = Math.floor(tomorrow.getTime() / 1000);
  const tomorrowEnd = tomorrowStart + 86400;

  const fromMin = timeToMinutes(from);
  const toMin = timeToMinutes(to);

  const hours = data.hourly
    .filter((h) => {
      if (h.dt < tomorrowStart || h.dt >= tomorrowEnd) return false;
      const date = new Date(h.dt * 1000);
      const min = date.getHours() * 60 + date.getMinutes();
      return min >= (fromMin - 59) && min <= toMin;
    })
    .map((h) => {
      const date = new Date(h.dt * 1000);
      const weatherId = h.weather[0]?.id ?? 0;
      // OWM 611-616 = sleet/freezing rain, or temp <= 0 with precipitation = verglas risk
      const ice = (weatherId >= 611 && weatherId <= 616) || (h.temp <= 0 && h.pop > 0);
      return {
        hour: date.getHours(),
        pop: Math.round(h.pop * 100),
        rainMm: h.rain?.["1h"] ?? 0,
        snowMm: h.snow?.["1h"] ?? 0,
        ice,
        description: h.weather[0]?.description ?? "",
        icon: weatherEmoji(h.weather[0]?.icon ?? ""),
        temp: Math.round(h.temp),
      };
    });

  debug("Parsed forecast hours", hours);
  return hours;
}

export async function fetchRouteForecast(
  departureLat: number,
  departureLon: number,
  arrivalLat: number,
  arrivalLon: number,
  apiKey: string,
  from: TimeOfDay,
  to: TimeOfDay,
): Promise<RouteForecast> {
  const [departureHours, arrivalHours] = await Promise.all([
    fetchLocationForecast(departureLat, departureLon, apiKey, from, to),
    fetchLocationForecast(arrivalLat, arrivalLon, apiKey, from, to),
  ]);

  const depMax = departureHours.reduce((m, h) => Math.max(m, h.pop), 0);
  const arrMax = arrivalHours.reduce((m, h) => Math.max(m, h.pop), 0);
  const avgMaxPop = Math.round((depMax + arrMax) / 2);

  const allHours = [...departureHours, ...arrivalHours];
  const hasSnow = allHours.some((h) => h.snowMm > 0);
  const hasIce = allHours.some((h) => h.ice);
  const avgTemp = allHours.length > 0
    ? Math.round(allHours.reduce((s, h) => s + h.temp, 0) / allHours.length)
    : 0;

  // Pick description/icon from the hour with highest pop
  const worst = allHours.length > 0
    ? allHours.reduce((a, b) => (b.pop > a.pop ? b : a))
    : null;
  const description = worst?.description ?? "";
  const icon = worst?.icon ?? "";

  debug("Route forecast", { depMax, arrMax, avgMaxPop, avgTemp, description, hasSnow, hasIce });

  return { departureHours, arrivalHours, avgMaxPop, avgTemp, description, icon, hasSnow, hasIce };
}

export async function fetchDailySummary(
  lat: number,
  lon: number,
  apiKey: string,
): Promise<DailySummary> {
  const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=current,minutely,hourly,alerts&units=metric&lang=fr&appid=${apiKey}`;

  debug("Fetching daily summary", { lat, lon });

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OWM API error ${res.status}: ${body}`);
  }

  const data: OWMResponse = await res.json();

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const tomorrowStart = Math.floor(tomorrow.getTime() / 1000);
  const tomorrowEnd = tomorrowStart + 86400;

  const day = data.daily?.find((d) => d.dt >= tomorrowStart && d.dt < tomorrowEnd);

  if (!day) {
    debug("No daily data found for tomorrow");
    return { avgTemp: 0, pop: 0, description: "", icon: "" };
  }

  return {
    avgTemp: Math.round(day.temp.day),
    pop: Math.round(day.pop * 100),
    description: day.weather[0]?.description ?? "",
    icon: weatherEmoji(day.weather[0]?.icon ?? ""),
  };
}

// Re-export for testing
export { fetchLocationForecast };
