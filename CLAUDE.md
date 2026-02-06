# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Will It Rain is an AWS Lambda function (Node.js 20, TypeScript) that checks weather forecasts via OpenWeatherMap One Call API 3.0 and sends Discord webhook notifications about rain/snow/ice for a daily commute. All Discord messages are in French. Zero runtime dependencies — everything is bundled into a single ESM file.

## Commands

- `npm run build` — Bundle with esbuild into dist/index.mjs
- `npm run package` — Build + zip for Lambda deployment
- `npm run dev` — Run locally with tsx (loads .env)
- `npm test` — Run tests (Vitest, single run)
- `npm run test:watch` — Run tests in watch mode

## Architecture

Four modules with a linear data flow:

1. **config.ts** — Parses and validates environment variables (coordinates, HH:MM times, API keys, thresholds)
2. **weather.ts** — Fetches OpenWeatherMap hourly/daily forecasts, filters by time ranges, detects rain/snow/ice
3. **discord.ts** — Formats forecasts into Discord embeds and verdict messages, sends via webhook
4. **logger.ts** — Console logging with debug toggle

**Entry point** (`index.ts`): AWS Lambda handler that loads config → fetches forecasts for both commute directions in parallel → sends Discord notifications. Also runs standalone when executed locally.

## Key Design Details

- **Dual execution mode**: Detects Lambda vs local execution; when run locally, the handler self-invokes
- **Route forecasting**: Averages max precipitation probability across home and work locations for each commute direction
- **Threshold alerting**: Pings @everyone on Discord when precipitation exceeds configurable RAIN_THRESHOLD
- **Build output**: Single minified ESM file (dist/index.mjs) targeting Node 20, arm64 Lambda

## Environment Variables

Configured via `.env` locally or Lambda environment variables in AWS. See `.env.example` for the full list. Required: two coordinate pairs (home/work), four HH:MM times (departure/arrival each way), OWM_API_KEY, DISCORD_WEBHOOK_URL. Optional: RAIN_THRESHOLD (default 30), DEBUG (default false).
