import { describe, it, expect } from "vitest";
import { buildDetailedEmbed, buildVerdictMessage } from "../src/discord.js";
import type { DailySummary, RouteForecast } from "../src/weather.js";

const mockDaily: DailySummary = {
  avgTemp: 13,
  pop: 45,
  description: "pluie modérée",
  icon: "🌦️",
};

const mockForecast: RouteForecast = {
  departureHours: [
    { hour: 8, pop: 80, rainMm: 1.2, snowMm: 0, ice: false, description: "pluie légère", icon: "🌧️", temp: 12 },
    { hour: 9, pop: 20, rainMm: 0, snowMm: 0, ice: false, description: "nuageux", icon: "☁️", temp: 13 },
  ],
  arrivalHours: [
    { hour: 8, pop: 70, rainMm: 0.8, snowMm: 0, ice: false, description: "pluie légère", icon: "🌧️", temp: 11 },
    { hour: 9, pop: 30, rainMm: 0, snowMm: 0, ice: false, description: "nuageux", icon: "☁️", temp: 12 },
  ],
  avgMaxPop: 75,
  avgTemp: 12,
  description: "pluie légère",
  icon: "🌧️",
  hasSnow: false,
  hasIce: false,
};

const clearForecast: RouteForecast = {
  departureHours: [
    { hour: 17, pop: 5, rainMm: 0, snowMm: 0, ice: false, description: "dégagé", icon: "☀️", temp: 15 },
  ],
  arrivalHours: [
    { hour: 17, pop: 10, rainMm: 0, snowMm: 0, ice: false, description: "dégagé", icon: "☀️", temp: 14 },
  ],
  avgMaxPop: 8,
  avgTemp: 15,
  description: "dégagé",
  icon: "☀️",
  hasSnow: false,
  hasIce: false,
};

const snowForecast: RouteForecast = {
  departureHours: [
    { hour: 8, pop: 90, rainMm: 0, snowMm: 3.2, ice: true, description: "neige", icon: "❄️", temp: -2 },
  ],
  arrivalHours: [
    { hour: 8, pop: 85, rainMm: 0, snowMm: 2.1, ice: true, description: "neige", icon: "❄️", temp: -1 },
  ],
  avgMaxPop: 88,
  avgTemp: -2,
  description: "neige",
  icon: "❄️",
  hasSnow: true,
  hasIce: true,
};

describe("buildDetailedEmbed", () => {
  it("produces an embed with hourly breakdown for both locations", () => {
    const result = buildDetailedEmbed(
      { label: "🏠→🏢 Aller", departureLabel: "Domicile", arrivalLabel: "Travail", forecast: mockForecast, from: { hour: 8, minute: 30 }, to: { hour: 9, minute: 0 } },
      { label: "🏢→🏠 Retour", departureLabel: "Travail", arrivalLabel: "Domicile", forecast: clearForecast, from: { hour: 17, minute: 0 }, to: { hour: 18, minute: 0 } },
    ) as { embeds: { title: string; description: string }[] };

    expect(result.embeds).toHaveLength(1);
    expect(result.embeds[0].title).toContain("Prévisions");
    expect(result.embeds[0].description).toContain("Domicile");
    expect(result.embeds[0].description).toContain("Travail");
    expect(result.embeds[0].description).toContain("80%");
    expect(result.embeds[0].description).toContain("moy. 75%");
  });

  it("shows snow and ice in detailed lines only when present", () => {
    const result = buildDetailedEmbed(
      { label: "🏠→🏢 Aller", departureLabel: "Domicile", arrivalLabel: "Travail", forecast: snowForecast, from: { hour: 8, minute: 0 }, to: { hour: 9, minute: 0 } },
      { label: "🏢→🏠 Retour", departureLabel: "Travail", arrivalLabel: "Domicile", forecast: clearForecast, from: { hour: 17, minute: 0 }, to: { hour: 18, minute: 0 } },
    ) as { embeds: { description: string }[] };

    expect(result.embeds[0].description).toContain("❄️ 3.2mm");
    expect(result.embeds[0].description).toContain("🧊 verglas");
    // Clear forecast should NOT contain snow/ice markers
    expect(result.embeds[0].description).not.toContain("❄️ 0.0mm");
  });
});

describe("buildVerdictMessage", () => {
  it("alerts when avg rain exceeds threshold", () => {
    const result = buildVerdictMessage(mockForecast, clearForecast, 30, mockDaily) as { content: string };

    expect(result.content).toContain("@everyone");
    expect(result.content).toContain("Alerte pluie");
    expect(result.content).toContain("📅 Journée : 🌦️ pluie modérée | 45% | 13°C");
    expect(result.content).toContain("❌ Matin : 🌧️ pluie légère | 75% | 12°C");
    expect(result.content).toContain("✅ Soir : ☀️ dégagé | 8% | 15°C");
  });

  it("shows clear when below threshold", () => {
    const result = buildVerdictMessage(clearForecast, clearForecast, 30, mockDaily) as { content: string };

    expect(result.content).toContain("@everyone");
    expect(result.content).toContain("Pas de pluie prévue demain");
    expect(result.content).not.toContain("Neige");
    expect(result.content).not.toContain("verglas");
  });

  it("uses custom threshold", () => {
    const result = buildVerdictMessage(mockForecast, clearForecast, 90, mockDaily) as { content: string };

    expect(result.content).toContain("Pas de pluie prévue demain");
  });

  it("includes snow and ice warnings when present", () => {
    const result = buildVerdictMessage(snowForecast, clearForecast, 30, mockDaily) as { content: string };

    expect(result.content).toContain("❄️ Neige prévue");
    expect(result.content).toContain("🧊 Risque de verglas");
  });
});
