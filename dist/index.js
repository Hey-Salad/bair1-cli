#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
// ── ANSI colors ──────────────────────────────────────────────────────────────
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const WHITE = "\x1b[37m";
const BLUE = "\x1b[34m";
const MAGENTA = "\x1b[35m";
// ── Config helpers ───────────────────────────────────────────────────────────
const CONFIG_DIR = join(homedir(), ".bair1");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const API_BASE = "https://bair1.live";
function loadConfig() {
    try {
        if (existsSync(CONFIG_FILE)) {
            return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
        }
    }
    catch {
        // ignore
    }
    return {};
}
function saveConfig(config) {
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
    }
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", "utf-8");
}
// ── API helpers ──────────────────────────────────────────────────────────────
async function apiFetch(path, params) {
    const config = loadConfig();
    const url = new URL(path, API_BASE);
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== "") {
                url.searchParams.set(k, v);
            }
        }
    }
    const headers = {
        Accept: "application/json",
    };
    if (config.apiKey) {
        headers["Authorization"] = `Bearer ${config.apiKey}`;
    }
    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`API error ${res.status}: ${res.statusText}${body ? ` - ${body}` : ""}`);
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
        return res.json();
    }
    return res.text();
}
// ── AQI color helper ─────────────────────────────────────────────────────────
function aqiColor(aqi) {
    if (aqi <= 50)
        return GREEN;
    if (aqi <= 100)
        return YELLOW;
    return RED;
}
function aqiLabel(aqi) {
    if (aqi <= 50)
        return `${GREEN}Good${RESET}`;
    if (aqi <= 100)
        return `${YELLOW}Moderate${RESET}`;
    if (aqi <= 150)
        return `${YELLOW}Unhealthy for Sensitive Groups${RESET}`;
    if (aqi <= 200)
        return `${RED}Unhealthy${RESET}`;
    if (aqi <= 300)
        return `${RED}Very Unhealthy${RESET}`;
    return `${RED}Hazardous${RESET}`;
}
// ── Formatting helpers ───────────────────────────────────────────────────────
function formatTimestamp(ts) {
    const d = new Date(ts);
    return d.toLocaleString();
}
function printReading(r) {
    const aqi = typeof r.aqi === "number" ? r.aqi : 0;
    const color = aqiColor(aqi);
    console.log("");
    console.log(`${BOLD}${CYAN}  Bair1 Air Quality Reading${RESET}`);
    console.log(`${DIM}  ${"─".repeat(40)}${RESET}`);
    if (r.deviceName || r.device_name || r.deviceId || r.device_id) {
        console.log(`  ${BOLD}Device:${RESET}    ${r.deviceName ?? r.device_name ?? r.deviceId ?? r.device_id}`);
    }
    if (r.timestamp || r.created_at || r.createdAt) {
        console.log(`  ${BOLD}Time:${RESET}      ${formatTimestamp(String(r.timestamp ?? r.created_at ?? r.createdAt))}`);
    }
    console.log(`  ${BOLD}AQI:${RESET}       ${color}${BOLD}${aqi}${RESET} ${aqiLabel(aqi)}`);
    if (r.pm25 !== undefined || r.pm2_5 !== undefined) {
        console.log(`  ${BOLD}PM2.5:${RESET}     ${r.pm25 ?? r.pm2_5} ug/m3`);
    }
    if (r.pm10 !== undefined) {
        console.log(`  ${BOLD}PM10:${RESET}      ${r.pm10} ug/m3`);
    }
    if (r.temperature !== undefined) {
        console.log(`  ${BOLD}Temp:${RESET}      ${r.temperature} C`);
    }
    if (r.humidity !== undefined) {
        console.log(`  ${BOLD}Humidity:${RESET}  ${r.humidity}%`);
    }
    if (r.airState || r.air_state) {
        const state = String(r.airState ?? r.air_state);
        console.log(`  ${BOLD}State:${RESET}     ${state}`);
    }
    console.log("");
}
function printTable(rows, columns) {
    // Header
    const header = columns.map((c) => c.label.padEnd(c.width)).join("  ");
    console.log(`\n  ${BOLD}${header}${RESET}`);
    console.log(`  ${columns.map((c) => "─".repeat(c.width)).join("  ")}`);
    for (const row of rows) {
        const line = columns
            .map((c) => {
            const val = String(row[c.key] ?? "");
            return val.slice(0, c.width).padEnd(c.width);
        })
            .join("  ");
        console.log(`  ${line}`);
    }
    console.log("");
}
// ── CLI ──────────────────────────────────────────────────────────────────────
const program = new Command();
program
    .name("bair1")
    .description("CLI for querying Bair1 air quality sensor data")
    .version("1.0.0");
// ── latest ───────────────────────────────────────────────────────────────────
program
    .command("latest")
    .description("Show the latest air quality reading")
    .option("-d, --device <id>", "Device ID to query")
    .action(async (opts) => {
    try {
        const params = {};
        if (opts.device)
            params.device = opts.device;
        const data = await apiFetch("/api/readings/latest", params);
        const reading = (Array.isArray(data) ? data[0] : data);
        if (!reading) {
            console.log(`${YELLOW}No readings found.${RESET}`);
            return;
        }
        printReading(reading);
    }
    catch (err) {
        console.error(`${RED}Error:${RESET} ${err.message}`);
        process.exit(1);
    }
});
// ── readings ─────────────────────────────────────────────────────────────────
program
    .command("readings")
    .description("List recent readings for a device")
    .requiredOption("-d, --device <id>", "Device ID")
    .option("-l, --limit <n>", "Number of readings", "10")
    .action(async (opts) => {
    try {
        const data = await apiFetch(`/api/v1/devices/${opts.device}/readings`, {
            limit: opts.limit,
        });
        const readings = (Array.isArray(data) ? data : data.readings ?? []);
        if (readings.length === 0) {
            console.log(`${YELLOW}No readings found for device ${opts.device}.${RESET}`);
            return;
        }
        console.log(`\n${BOLD}${CYAN}  Readings for device ${opts.device}${RESET} (last ${opts.limit})\n`);
        printTable(readings.map((r) => ({
            ...r,
            time: formatTimestamp(String(r.timestamp ?? r.created_at ?? r.createdAt ?? "")),
        })), [
            { key: "time", label: "Timestamp", width: 22 },
            { key: "aqi", label: "AQI", width: 5 },
            { key: "pm25", label: "PM2.5", width: 8 },
            { key: "pm10", label: "PM10", width: 8 },
            { key: "temperature", label: "Temp", width: 6 },
            { key: "humidity", label: "Hum%", width: 6 },
        ]);
    }
    catch (err) {
        console.error(`${RED}Error:${RESET} ${err.message}`);
        process.exit(1);
    }
});
// ── devices ──────────────────────────────────────────────────────────────────
program
    .command("devices")
    .description("List all sensors")
    .action(async () => {
    try {
        const data = await apiFetch("/api/v1/devices");
        const devices = (Array.isArray(data) ? data : data.devices ?? []);
        if (devices.length === 0) {
            console.log(`${YELLOW}No devices found.${RESET}`);
            return;
        }
        console.log(`\n${BOLD}${CYAN}  Bair1 Devices${RESET}\n`);
        printTable(devices, [
            { key: "id", label: "ID", width: 12 },
            { key: "name", label: "Name", width: 24 },
            { key: "location", label: "Location", width: 24 },
            { key: "status", label: "Status", width: 10 },
        ]);
    }
    catch (err) {
        console.error(`${RED}Error:${RESET} ${err.message}`);
        process.exit(1);
    }
});
// ── export ───────────────────────────────────────────────────────────────────
program
    .command("export")
    .description("Export data for a device")
    .requiredOption("-d, --device <id>", "Device ID")
    .option("--from <date>", "Start date (ISO 8601)")
    .option("--to <date>", "End date (ISO 8601)")
    .option("-f, --format <fmt>", "Output format: csv or json", "json")
    .action(async (opts) => {
    try {
        const params = {
            device: opts.device,
            format: opts.format,
        };
        if (opts.from)
            params.from = opts.from;
        if (opts.to)
            params.to = opts.to;
        const data = await apiFetch("/api/v1/export", params);
        if (opts.format === "csv") {
            console.log(String(data));
        }
        else {
            console.log(JSON.stringify(data, null, 2));
        }
    }
    catch (err) {
        console.error(`${RED}Error:${RESET} ${err.message}`);
        process.exit(1);
    }
});
// ── status ───────────────────────────────────────────────────────────────────
program
    .command("status")
    .description("System health check")
    .action(async () => {
    try {
        console.log(`\n${BOLD}${CYAN}  Bair1 System Status${RESET}`);
        console.log(`${DIM}  ${"─".repeat(40)}${RESET}`);
        const start = Date.now();
        const data = await apiFetch("/api/readings/latest");
        const latency = Date.now() - start;
        const reading = (Array.isArray(data) ? data[0] : data);
        console.log(`  ${BOLD}API:${RESET}       ${GREEN}Reachable${RESET} (${latency}ms)`);
        if (reading) {
            const ts = String(reading.timestamp ?? reading.created_at ?? reading.createdAt ?? "");
            if (ts) {
                const age = Date.now() - new Date(ts).getTime();
                const ageMinutes = Math.round(age / 60000);
                const fresh = age < 5 * 60 * 1000;
                const color = fresh ? GREEN : RED;
                const label = fresh ? "Fresh" : "Stale";
                console.log(`  ${BOLD}Data:${RESET}      ${color}${label}${RESET} (last reading ${ageMinutes} min ago)`);
                console.log(`  ${BOLD}Last:${RESET}      ${formatTimestamp(ts)}`);
            }
        }
        else {
            console.log(`  ${BOLD}Data:${RESET}      ${YELLOW}No readings available${RESET}`);
        }
        console.log("");
    }
    catch (err) {
        console.log(`  ${BOLD}API:${RESET}       ${RED}Unreachable${RESET}`);
        console.log(`  ${BOLD}Error:${RESET}     ${err.message}`);
        console.log("");
        process.exit(1);
    }
});
// ── config ───────────────────────────────────────────────────────────────────
const configCmd = program
    .command("config")
    .description("Manage CLI configuration");
configCmd
    .command("set-key <apiKey>")
    .description("Save API key to ~/.bair1/config.json")
    .action((apiKey) => {
    const config = loadConfig();
    config.apiKey = apiKey;
    saveConfig(config);
    console.log(`${GREEN}API key saved to ${CONFIG_FILE}${RESET}`);
});
configCmd
    .command("show")
    .description("Show current configuration")
    .action(() => {
    const config = loadConfig();
    if (config.apiKey) {
        const masked = config.apiKey.slice(0, 4) + "..." + config.apiKey.slice(-4);
        console.log(`${BOLD}API Key:${RESET} ${masked}`);
    }
    else {
        console.log(`${YELLOW}No API key configured. Run: bair1 config set-key YOUR_KEY${RESET}`);
    }
    console.log(`${BOLD}Config:${RESET}  ${CONFIG_FILE}`);
});
// ── Parse ────────────────────────────────────────────────────────────────────
program.parse();
//# sourceMappingURL=index.js.map