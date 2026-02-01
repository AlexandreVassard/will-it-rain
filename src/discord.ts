import type { TimeOfDay } from "./config.js";
import type { DailySummary, HourlyForecast, RouteForecast } from "./weather.js";
import { debug } from "./logger.js";

interface RouteInfo {
  label: string;
  departureLabel: string;
  arrivalLabel: string;
  forecast: RouteForecast;
  from: TimeOfDay;
  to: TimeOfDay;
}

function formatTime(t: TimeOfDay): string {
  return `${String(t.hour).padStart(2, "0")}h${t.minute > 0 ? String(t.minute).padStart(2, "0") : ""}`;
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, "0")}h`;
}

function formatHourLine(h: HourlyForecast): string {
  let line = `  ${formatHour(h.hour)} — ${h.icon} ${h.description} | ${h.pop}% | ${h.rainMm.toFixed(1)}mm`;
  if (h.snowMm > 0) line += ` | ❄️ ${h.snowMm.toFixed(1)}mm`;
  if (h.ice) line += ` | 🧊 verglas`;
  line += ` | ${h.temp}°C`;
  return line;
}

function formatHours(hours: HourlyForecast[]): string {
  return hours.map(formatHourLine).join("\n");
}

function buildDetailedEmbed(departure: RouteInfo, returnRoute: RouteInfo): object {
  const formatRoute = (route: RouteInfo): string => {
    const header = `${route.label} (${formatTime(route.from)}–${formatTime(route.to)}) — moy. ${route.forecast.avgMaxPop}%`;
    if (route.forecast.departureHours.length === 0 && route.forecast.arrivalHours.length === 0) {
      return `${header}\n  Aucune donnée disponible`;
    }
    const sections: string[] = [];
    if (route.forecast.departureHours.length > 0) {
      sections.push(`  📍 ${route.departureLabel}\n${formatHours(route.forecast.departureHours)}`);
    }
    if (route.forecast.arrivalHours.length > 0) {
      sections.push(`  📍 ${route.arrivalLabel}\n${formatHours(route.forecast.arrivalHours)}`);
    }
    return `${header}\n${sections.join("\n")}`;
  };

  const description = [
    formatRoute(departure),
    "",
    formatRoute(returnRoute),
  ].join("\n");

  return {
    embeds: [
      {
        title: "🌦️ Prévisions trajet de demain",
        description,
        color: 0x5865f2,
      },
    ],
  };
}

function buildVerdictMessage(
  departure: RouteForecast,
  returnRoute: RouteForecast,
  threshold: number,
  daily: DailySummary,
): object {
  const morningRain = departure.avgMaxPop >= threshold;
  const eveningRain = returnRoute.avgMaxPop >= threshold;

  const dailyLine = `📅 Journée : ${daily.icon} ${daily.description} | ${daily.pop}% | ${daily.avgTemp}°C`;
  const morningText = `🌅 Matin : ${departure.icon} ${departure.description} | ${departure.avgMaxPop}% | ${departure.avgTemp}°C`;
  const eveningText = `🌇 Soir : ${returnRoute.icon} ${returnRoute.description} | ${returnRoute.avgMaxPop}% | ${returnRoute.avgTemp}°C`;

  const anyRain = morningRain || eveningRain;
  const title = anyRain
    ? "☔ Alerte pluie pour demain !"
    : "☀️ Pas de pluie prévue demain !";

  const warnings: string[] = [];
  if (departure.hasSnow || returnRoute.hasSnow) warnings.push("❄️ Neige prévue sur le trajet !");
  if (departure.hasIce || returnRoute.hasIce) warnings.push("🧊 Risque de verglas !");

  const lines = [title, dailyLine, morningText, eveningText, ...warnings];

  return {
    content: `@everyone\n${lines.join("\n")}`,
  };
}

export async function sendDiscordNotifications(
  webhookUrl: string,
  departure: RouteInfo,
  returnRoute: RouteInfo,
  threshold: number,
  daily: DailySummary,
): Promise<void> {
  // Message 1: detailed embed (no ping)
  const detailed = buildDetailedEmbed(departure, returnRoute);
  debug("Sending detailed embed", JSON.stringify(detailed));

  const res1 = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(detailed),
  });
  if (!res1.ok) {
    const body = await res1.text();
    throw new Error(`Discord webhook failed (detailed): ${res1.status} ${body}`);
  }

  // Message 2: simple verdict with @everyone
  const verdict = buildVerdictMessage(departure.forecast, returnRoute.forecast, threshold, daily);
  debug("Sending verdict message", JSON.stringify(verdict));

  const res2 = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(verdict),
  });
  if (!res2.ok) {
    const body = await res2.text();
    throw new Error(`Discord webhook failed (verdict): ${res2.status} ${body}`);
  }
}

// Exported for testing
export { buildDetailedEmbed, buildVerdictMessage };
export type { RouteInfo };
