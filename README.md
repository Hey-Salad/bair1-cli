# Bair1 SDK and CLI

JavaScript SDK and command-line tool for Bair1 air quality sensor data.

## Install

```bash
npm install @heysalad/bair1
```

For global CLI use:

```bash
npm install -g @heysalad/bair1
```

## SDK

```ts
import { Bair1Client } from "@heysalad/bair1";

const bair1 = new Bair1Client({
  apiKey: process.env.BAIR1_API_KEY,
});

const latest = await bair1.latest();
console.log(latest.pm25, latest.aqi);

const devices = await bair1.devices();
console.log(devices);
```

## CLI

```bash
bair1 config set-key "$BAIR1_API_KEY"
bair1 status
bair1 latest
bair1 devices
bair1 export --device YOUR_DEVICE_ID --format csv
```

## Agent Use

Use this package when an agent runtime needs direct TypeScript access to Bair1.
Use `@heysalad/bair1-mcp` when the agent supports MCP and should call tools
instead of importing code.
