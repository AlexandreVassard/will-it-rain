import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchLocationForecast, fetchRouteForecast } from "../src/weather.js";
import { setDebug } from "../src/logger.js";

setDebug(false);

function createMockHourly(
  date: Date, hour: number, pop: number, rainMm: number,
  opts?: { temp?: number; snowMm?: number; weatherId?: number; icon?: string },
) {
  const dt = new Date(date);
  dt.setHours(hour, 0, 0, 0);
  return {
    dt: Math.floor(dt.getTime() / 1000),
    temp: opts?.temp ?? 15,
    pop: pop / 100,
    weather: [{ id: opts?.weatherId ?? 500, description: "pluie légère", icon: opts?.icon ?? "10d" }],
    ...(rainMm > 0 ? { rain: { "1h": rainMm } } : {}),
    ...(opts?.snowMm ? { snow: { "1h": opts.snowMm } } : {}),
  };
}

function getTomorrow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

describe("fetchLocationForecast", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses hourly forecast and filters by time range", async () => {
    const tomorrow = getTomorrow();
    const mockData = {
      hourly: [
        createMockHourly(tomorrow, 7, 10, 0),
        createMockHourly(tomorrow, 8, 60, 1.2),
        createMockHourly(tomorrow, 9, 80, 2.5),
        createMockHourly(tomorrow, 10, 20, 0),
      ],
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    }));

    const result = await fetchLocationForecast(48.85, 2.35, "fake-key", { hour: 8, minute: 0 }, { hour: 9, minute: 0 });

    expect(result).toHaveLength(2);
    expect(result[0].hour).toBe(8);
    expect(result[0].pop).toBe(60);
    expect(result[0].rainMm).toBe(1.2);
    expect(result[0].snowMm).toBe(0);
    expect(result[0].ice).toBe(false);
    expect(result[1].hour).toBe(9);
    expect(result[1].pop).toBe(80);
  });

  it("detects snow and ice", async () => {
    const tomorrow = getTomorrow();
    const mockData = {
      hourly: [
        createMockHourly(tomorrow, 8, 90, 0, { temp: -2, snowMm: 3.5, weatherId: 601, icon: "13d" }),
        createMockHourly(tomorrow, 9, 70, 0.5, { temp: -1, weatherId: 611, icon: "13d" }),
      ],
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    }));

    const result = await fetchLocationForecast(48.85, 2.35, "fake-key", { hour: 8, minute: 0 }, { hour: 9, minute: 0 });

    expect(result[0].snowMm).toBe(3.5);
    expect(result[0].ice).toBe(true); // temp <= 0 with pop > 0
    expect(result[1].ice).toBe(true); // weatherId 611 = sleet
  });

  it("throws on API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    }));

    await expect(fetchLocationForecast(48.85, 2.35, "bad-key", { hour: 8, minute: 0 }, { hour: 9, minute: 0 })).rejects.toThrow("OWM API error 401");
  });

  it("returns empty hours when no data in range", async () => {
    const tomorrow = getTomorrow();
    const mockData = {
      hourly: [createMockHourly(tomorrow, 12, 50, 1.0)],
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    }));

    const result = await fetchLocationForecast(48.85, 2.35, "fake-key", { hour: 8, minute: 0 }, { hour: 9, minute: 0 });
    expect(result).toHaveLength(0);
  });
});

describe("fetchRouteForecast", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("averages max pop from both locations", async () => {
    const tomorrow = getTomorrow();
    let callCount = 0;

    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => {
      callCount++;
      const pop = callCount === 1 ? 80 : 60; // departure 80%, arrival 60%
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          hourly: [createMockHourly(tomorrow, 8, pop, 1.0)],
        }),
      });
    }));

    const result = await fetchRouteForecast(48.85, 2.35, 48.86, 2.34, "fake-key", { hour: 8, minute: 0 }, { hour: 9, minute: 0 });

    expect(result.departureHours).toHaveLength(1);
    expect(result.arrivalHours).toHaveLength(1);
    expect(result.avgMaxPop).toBe(70); // avg(80, 60)
    expect(result.hasSnow).toBe(false);
    expect(result.hasIce).toBe(false);
  });
});
