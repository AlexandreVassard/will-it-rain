import type { Handler } from "aws-lambda";
import { loadConfig } from "./config.js";
import { setDebug, info, error } from "./logger.js";
import { fetchRouteForecast, fetchDailySummary } from "./weather.js";
import { sendDiscordNotifications } from "./discord.js";

async function main(): Promise<void> {
  const config = loadConfig();
  setDebug(config.debug);

  info("Fetching forecasts...");

  const [departureForecast, returnForecast, dailySummary] = await Promise.all([
    fetchRouteForecast(config.homeLat, config.homeLon, config.workLat, config.workLon, config.owmApiKey, config.departureTime, config.arrivalTime),
    fetchRouteForecast(config.workLat, config.workLon, config.homeLat, config.homeLon, config.owmApiKey, config.returnDepartureTime, config.returnArrivalTime),
    fetchDailySummary(config.homeLat, config.homeLon, config.owmApiKey),
  ]);

  info("Sending Discord notifications...");

  await sendDiscordNotifications(
    config.discordWebhookUrl,
    {
      label: "🏠→🏢 Aller",
      departureLabel: "Domicile",
      arrivalLabel: "Travail",
      forecast: departureForecast,
      from: config.departureTime,
      to: config.arrivalTime,
    },
    {
      label: "🏢→🏠 Retour",
      departureLabel: "Travail",
      arrivalLabel: "Domicile",
      forecast: returnForecast,
      from: config.returnDepartureTime,
      to: config.returnArrivalTime,
    },
    config.rainThreshold,
    dailySummary,
  );

  info("Done!");
}

export const handler: Handler = async () => {
  try {
    await main();
    return { statusCode: 200, body: "OK" };
  } catch (err) {
    error("Lambda execution failed", err);
    throw err;
  }
};

// Local execution
const isLocal = !process.env.AWS_LAMBDA_FUNCTION_NAME;
if (isLocal) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
