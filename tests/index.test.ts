import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config.js";

const TIME_KEYS = [
  "HOME_LAT", "HOME_LON", "WORK_LAT", "WORK_LON",
  "DEPARTURE_TIME", "ARRIVAL_TIME", "RETURN_DEPARTURE_TIME", "RETURN_ARRIVAL_TIME",
  "OWM_API_KEY", "DISCORD_WEBHOOK_URL", "RAIN_THRESHOLD", "DEBUG",
];

function setAllEnv() {
  process.env.HOME_LAT = "48.8566";
  process.env.HOME_LON = "2.3522";
  process.env.WORK_LAT = "48.8606";
  process.env.WORK_LON = "2.3376";
  process.env.DEPARTURE_TIME = "8:30";
  process.env.ARRIVAL_TIME = "9:00";
  process.env.RETURN_DEPARTURE_TIME = "17:45";
  process.env.RETURN_ARRIVAL_TIME = "18:15";
  process.env.OWM_API_KEY = "test-key";
  process.env.DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/test";
}

function cleanEnv() {
  for (const key of TIME_KEYS) {
    delete process.env[key];
  }
}

describe("loadConfig", () => {
  it("throws on missing required env var", () => {
    cleanEnv();
    expect(() => loadConfig()).toThrow("Missing required environment variable");
  });

  it("parses all env vars correctly including HH:MM times", () => {
    setAllEnv();
    process.env.RAIN_THRESHOLD = "40";
    process.env.DEBUG = "true";

    const config = loadConfig();

    expect(config.homeLat).toBe(48.8566);
    expect(config.workLon).toBe(2.3376);
    expect(config.departureTime).toEqual({ hour: 8, minute: 30 });
    expect(config.arrivalTime).toEqual({ hour: 9, minute: 0 });
    expect(config.returnDepartureTime).toEqual({ hour: 17, minute: 45 });
    expect(config.returnArrivalTime).toEqual({ hour: 18, minute: 15 });
    expect(config.rainThreshold).toBe(40);
    expect(config.debug).toBe(true);

    cleanEnv();
  });

  it("defaults rain threshold to 30", () => {
    setAllEnv();
    delete process.env.RAIN_THRESHOLD;
    delete process.env.DEBUG;

    const config = loadConfig();
    expect(config.rainThreshold).toBe(30);
    expect(config.debug).toBe(false);

    cleanEnv();
  });

  it("throws on invalid time format", () => {
    setAllEnv();
    process.env.DEPARTURE_TIME = "8";

    expect(() => loadConfig()).toThrow("HH:MM");

    cleanEnv();
  });
});
