export interface TimeOfDay {
  hour: number;
  minute: number;
}

export interface Config {
  homeLat: number;
  homeLon: number;
  workLat: number;
  workLon: number;
  departureTime: TimeOfDay;
  arrivalTime: TimeOfDay;
  returnDepartureTime: TimeOfDay;
  returnArrivalTime: TimeOfDay;
  owmApiKey: string;
  discordWebhookUrl: string;
  rainThreshold: number;
  debug: boolean;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requireEnvNumber(name: string): number {
  const raw = requireEnv(name);
  const num = Number(raw);
  if (Number.isNaN(num)) {
    throw new Error(`Environment variable ${name} must be a number, got: ${raw}`);
  }
  return num;
}

function requireEnvTime(name: string): TimeOfDay {
  const raw = requireEnv(name);
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Environment variable ${name} must be in HH:MM format, got: ${raw}`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Environment variable ${name} has invalid time: ${raw}`);
  }
  return { hour, minute };
}

export function loadConfig(): Config {
  return {
    homeLat: requireEnvNumber("HOME_LAT"),
    homeLon: requireEnvNumber("HOME_LON"),
    workLat: requireEnvNumber("WORK_LAT"),
    workLon: requireEnvNumber("WORK_LON"),
    departureTime: requireEnvTime("DEPARTURE_TIME"),
    arrivalTime: requireEnvTime("ARRIVAL_TIME"),
    returnDepartureTime: requireEnvTime("RETURN_DEPARTURE_TIME"),
    returnArrivalTime: requireEnvTime("RETURN_ARRIVAL_TIME"),
    owmApiKey: requireEnv("OWM_API_KEY"),
    discordWebhookUrl: requireEnv("DISCORD_WEBHOOK_URL"),
    rainThreshold: Number(process.env.RAIN_THRESHOLD ?? "30"),
    debug: process.env.DEBUG === "true",
  };
}
