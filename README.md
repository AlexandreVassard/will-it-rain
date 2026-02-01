# Will It Rain ☔

**This project was fully made with Claude except for this sentence.**

AWS Lambda that checks tomorrow's rain forecast for your commute and sends Discord notifications.

## Prerequisites

- **Node.js 20+**
- **npm**
- **OpenWeatherMap API key** — [One Call API 3.0](https://openweathermap.org/api/one-call-3)
- **Discord webhook URL** — [Create a webhook](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks)

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Run locally

```bash
npm run dev
```

This loads `.env` and executes the Lambda logic locally — it will fetch real weather data and send Discord messages.

### 4. Run tests

```bash
npm test
```

### 5. Build for Lambda

```bash
npm run build
```

This produces a single `dist/index.mjs` file (~few KB) containing all code bundled and minified.

### 6. Package for upload

```bash
npm run package
```

Creates `will-it-rain.zip` ready for Lambda upload.

## Environment Variables

| Variable                | Required | Description                                         | Example   |
| ----------------------- | -------- | --------------------------------------------------- | --------- |
| `HOME_LAT`              | Yes      | Home latitude                                       | `48.8566` |
| `HOME_LON`              | Yes      | Home longitude                                      | `2.3522`  |
| `WORK_LAT`              | Yes      | Work latitude                                       | `48.8606` |
| `WORK_LON`              | Yes      | Work longitude                                      | `2.3376`  |
| `DEPARTURE_HOUR`        | Yes      | Hour you leave home                                 | `8`       |
| `ARRIVAL_HOUR`          | Yes      | Hour you arrive at work                             | `9`       |
| `RETURN_DEPARTURE_HOUR` | Yes      | Hour you leave work                                 | `17`      |
| `RETURN_ARRIVAL_HOUR`   | Yes      | Hour you arrive home                                | `18`      |
| `OWM_API_KEY`           | Yes      | OpenWeatherMap API key                              | —         |
| `DISCORD_WEBHOOK_URL`   | Yes      | Discord webhook URL                                 | —         |
| `RAIN_THRESHOLD`        | No       | Rain probability % to trigger alert (default: `30`) | `30`      |
| `DEBUG`                 | No       | Enable debug logs (default: `false`)                | `true`    |

## AWS Deployment Guide

### Step 1: Create an IAM Role

The Lambda only needs CloudWatch Logs permissions.

**AWS Console:**

1. Go to **IAM** → **Roles** → **Create role**
2. Trusted entity: **AWS service** → **Lambda**
3. Attach policy: `AWSLambdaBasicExecutionRole`
4. Name: `will-it-rain-role`

**AWS CLI:**

```bash
# Create the role
aws iam create-role \
  --role-name will-it-rain-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach CloudWatch Logs policy
aws iam attach-role-policy \
  --role-name will-it-rain-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

### Step 2: Create the Lambda Function

**AWS Console:**

1. Go to **Lambda** → **Create function**
2. Function name: `will-it-rain`
3. Runtime: **Node.js 20.x**
4. Architecture: **arm64** (cheaper, faster)
5. Execution role: **will-it-rain-role**
6. Handler: `index.handler`
7. Upload `will-it-rain.zip`
8. Set memory to **128 MB** (sufficient)
9. Set timeout to **30 seconds**

**AWS CLI:**

```bash
aws lambda create-function \
  --function-name will-it-rain \
  --runtime nodejs20.x \
  --architectures arm64 \
  --handler index.handler \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/will-it-rain-role \
  --zip-file fileb://will-it-rain.zip \
  --memory-size 128 \
  --timeout 30
```

### Step 3: Set Environment Variables

**AWS Console:**

1. In your Lambda → **Configuration** → **Environment variables**
2. Add all variables from the table above

**AWS CLI:**

```bash
aws lambda update-function-configuration \
  --function-name will-it-rain \
  --environment "Variables={
    HOME_LAT=48.8566,
    HOME_LON=2.3522,
    WORK_LAT=48.8606,
    WORK_LON=2.3376,
    DEPARTURE_HOUR=8,
    ARRIVAL_HOUR=9,
    RETURN_DEPARTURE_HOUR=17,
    RETURN_ARRIVAL_HOUR=18,
    OWM_API_KEY=your_key_here,
    DISCORD_WEBHOOK_URL=your_webhook_here,
    RAIN_THRESHOLD=30,
    DEBUG=false
  }"
```

### Step 4: Create EventBridge Scheduled Rule

Run the Lambda every night (e.g., 8 PM UTC).

**AWS Console:**

1. Go to **Amazon EventBridge** → **Rules** → **Create rule**
2. Name: `will-it-rain-nightly`
3. Schedule expression: `cron(0 20 * * ? *)`
4. Target: Lambda function → `will-it-rain`

**AWS CLI:**

```bash
# Create the rule
aws events put-rule \
  --name will-it-rain-nightly \
  --schedule-expression "cron(0 20 * * ? *)"

# Add Lambda as target
aws events put-targets \
  --rule will-it-rain-nightly \
  --targets "Id"="1","Arn"="arn:aws:lambda:YOUR_REGION:YOUR_ACCOUNT_ID:function:will-it-rain"

# Grant EventBridge permission to invoke the Lambda
aws lambda add-permission \
  --function-name will-it-rain \
  --statement-id will-it-rain-eventbridge \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:YOUR_REGION:YOUR_ACCOUNT_ID:rule/will-it-rain-nightly
```

### Step 5: Test

**AWS Console:**

1. In your Lambda → **Test** tab
2. Create a test event with `{}` as payload
3. Click **Test** — check CloudWatch Logs and your Discord channel

**AWS CLI:**

```bash
aws lambda invoke \
  --function-name will-it-rain \
  --payload '{}' \
  response.json
```

## Updating the Lambda

```bash
npm run build && npm run package
aws lambda update-function-code \
  --function-name will-it-rain \
  --zip-file fileb://will-it-rain.zip
```

## Project Structure

```
src/
├── index.ts      # Lambda handler + local runner
├── config.ts     # Environment variable parsing
├── weather.ts    # OpenWeatherMap API client
├── discord.ts    # Discord webhook notifications (French)
└── logger.ts     # Debug/info/error logging
tests/
├── weather.test.ts
├── discord.test.ts
└── index.test.ts
```

All source files are bundled into a single `dist/index.mjs` at build time. No external dependencies are used at runtime.
