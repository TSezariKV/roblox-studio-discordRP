// helper.js — Discord Rich Presence bridge for Roblox Studio
const RPC = require("discord-rpc");
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = 3847;
const HOST = "127.0.0.1";
const STUDIO_TIMEOUT_MS = 45_000;
const DISCORD_RETRY_MS = 5_000;
const DEFAULT_IMAGE_KEY = "studio";

const baseDir = process.pkg ? path.dirname(process.execPath) : __dirname;
const logFile = path.join(baseDir, "discordrp.log");

function log(...args) {
  const ts = new Date().toLocaleTimeString();
  const line = `[${ts}] ${args.join(" ")}`;
  console.log(line);
  try {
    fs.appendFileSync(logFile, line + "\n");
  } catch {
    /* ignore */
  }
}

function loadClientId() {
  if (process.env.DISCORD_CLIENT_ID) {
    return process.env.DISCORD_CLIENT_ID.trim();
  }

  const candidates = [
    path.join(baseDir, "config.json"),
    path.join(process.env.LOCALAPPDATA || "", "DiscordRP", "config.json"),
    path.join(__dirname, "config.json"),
  ];

  for (const configPath of candidates) {
    if (!configPath || !fs.existsSync(configPath)) continue;
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (config.clientId) return String(config.clientId).trim();
    } catch {
      /* ignore */
    }
  }

  return "";
}

const clientId = loadClientId();

if (!clientId || clientId === "YOUR_DISCORD_APP_ID") {
  console.error(`
Discord Rich Presence helper failed to start.

Missing Application ID. Put it in config.json next to this program:
  { "clientId": "YOUR_APPLICATION_ID" }

Create an app at: https://discord.com/developers/applications
`);
  process.exit(1);
}

let rpc = null;
let rpcReady = false;
let connecting = false;
let startTimestamp = null;
let lastStudioSeen = 0;
let studioActive = false;
let clearTimer = null;

/** @type {{ details: string, state: string, largeImageKey: string, largeImageText: string } | null} */
let current = null;

const iconCache = new Map();

function httpGetJson(urlString) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      urlString,
      { headers: { "User-Agent": "DiscordRP/1.0" } },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          const ok = res.statusCode >= 200 && res.statusCode < 300;
          try {
            resolve({
              ok,
              status: res.statusCode,
              data: body ? JSON.parse(body) : null,
            });
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(10_000, () => {
      req.destroy(new Error("Request timed out"));
    });
  });
}

async function clearPresence(reason) {
  studioActive = false;
  current = null;
  startTimestamp = null;
  if (clearTimer) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }

  if (!rpcReady || !rpc) return;

  try {
    await rpc.clearActivity();
    log(`Presence cleared (${reason})`);
  } catch (err) {
    log("Failed to clear presence:", err.message);
  }
}

function touchStudio() {
  lastStudioSeen = Date.now();
  studioActive = true;

  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = setTimeout(() => {
    if (Date.now() - lastStudioSeen >= STUDIO_TIMEOUT_MS) {
      clearPresence("Studio closed or stopped heartbeating");
    }
  }, STUDIO_TIMEOUT_MS);
}

async function setPresence() {
  if (!rpcReady || !rpc || !current || !studioActive) return;

  const activity = {
    details: current.details,
    state: current.state,
    largeImageKey: current.largeImageKey,
    largeImageText: current.largeImageText,
    startTimestamp: startTimestamp || Date.now(),
  };

  await rpc.setActivity(activity);
}

async function fetchRobloxIcon(placeId, universeId) {
  const cacheKey = `p:${placeId}|u:${universeId}`;
  if (iconCache.has(cacheKey)) return iconCache.get(cacheKey);

  const tryUrls = [];

  if (universeId && Number(universeId) > 0) {
    tryUrls.push(
      `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=512x512&format=Png&isCircular=false`
    );
  }

  if (placeId && Number(placeId) > 0) {
    tryUrls.push(
      `https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${placeId}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false`
    );
  }

  for (const apiUrl of tryUrls) {
    try {
      const res = await httpGetJson(apiUrl);
      if (!res.ok) continue;
      const entry = res.data?.data?.[0];
      if (entry?.state === "Completed" && entry.imageUrl) {
        iconCache.set(cacheKey, entry.imageUrl);
        return entry.imageUrl;
      }
    } catch (err) {
      log("Roblox thumbnail fetch failed:", err.message);
    }
  }

  return null;
}

async function fetchPlaceName(placeId) {
  if (!placeId || Number(placeId) <= 0) return null;

  try {
    const res = await httpGetJson(
      `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`
    );
    if (res.ok) {
      const name = res.data?.[0]?.name || res.data?.[0]?.Name;
      if (name) return name;
    }
  } catch {
    /* ignore */
  }

  try {
    const res = await httpGetJson(
      `https://www.roblox.com/places/api-get-details?assetId=${placeId}`
    );
    if (!res.ok) return null;
    return res.data?.Name || res.data?.name || null;
  } catch {
    return null;
  }
}

async function applyPresenceUpdate(data) {
  const placeId = Number(data.placeId || data.PlaceId || 0) || 0;
  const universeId =
    Number(data.universeId || data.UniverseId || data.gameId || 0) || 0;
  let name = (data.name || data.Name || data.placeName || "").trim();

  if (!name && placeId > 0) {
    name = (await fetchPlaceName(placeId)) || `Place ${placeId}`;
  }
  if (!name) name = "an untitled place";

  const details = data.details || "Working in Roblox Studio";
  const state = data.state || `Editing ${name}`;

  let imageKey = DEFAULT_IMAGE_KEY;
  if (data.largeImageKey && typeof data.largeImageKey === "string") {
    imageKey = data.largeImageKey;
  } else {
    const iconUrl = await fetchRobloxIcon(placeId, universeId);
    if (iconUrl) imageKey = iconUrl;
  }

  if (!startTimestamp) startTimestamp = Date.now();

  current = {
    details,
    state,
    largeImageKey: imageKey,
    largeImageText: name,
  };

  touchStudio();
  await setPresence();
  log(`Presence updated: ${state}`);
}

function attachRpcHandlers(client) {
  client.on("ready", async () => {
    rpcReady = true;
    connecting = false;
    log("Connected to Discord.");
    if (studioActive && current) {
      try {
        await setPresence();
      } catch (err) {
        log("Failed to restore presence:", err.message);
      }
    }
  });

  client.on("disconnected", () => {
    rpcReady = false;
    log("Disconnected from Discord — will retry…");
    scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (connecting) return;
  setTimeout(() => {
    connectDiscord().catch(() => {});
  }, DISCORD_RETRY_MS);
}

async function connectDiscord() {
  if (connecting || rpcReady) return;
  connecting = true;

  try {
    if (rpc) {
      try {
        rpc.removeAllListeners();
        rpc.destroy();
      } catch {
        /* ignore */
      }
      rpc = null;
    }

    rpc = new RPC.Client({ transport: "ipc" });
    attachRpcHandlers(rpc);

    await rpc.login({ clientId });
  } catch (err) {
    rpcReady = false;
    connecting = false;
    log(
      `Discord not ready (${err.message}). Retrying in ${DISCORD_RETRY_MS / 1000}s…`
    );
    scheduleReconnect();
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function send(res, status, text) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(text);
}

function sendJson(res, status, obj) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(obj));
}

async function handlePresenceRequest(req, res, url) {
  let data = {};

  for (const [key, value] of url.searchParams.entries()) {
    data[key] = value;
  }

  if (req.method === "POST") {
    const raw = await readBody(req);
    if (raw) {
      const parsed = JSON.parse(raw);
      data = { ...data, ...parsed };
    }
  }

  if (data.clear === true || data.clear === "true") {
    await clearPresence("explicit clear");
    send(res, 200, "cleared");
    return;
  }

  await applyPresenceUpdate(data);
  sendJson(res, 200, { ok: true, active: studioActive, presence: current });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    if (
      (req.method === "POST" || req.method === "GET") &&
      (url.pathname === "/presence" || url.pathname === "/")
    ) {
      await handlePresenceRequest(req, res, url);
      return;
    }

    if (req.method === "POST" && url.pathname === "/clear") {
      await clearPresence("POST /clear");
      send(res, 200, "cleared");
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        discord: rpcReady,
        studioActive,
        lastStudioSeen,
      });
      return;
    }

    send(res, 404, "not found");
  } catch (err) {
    log("Request error:", err.message);
    send(res, 400, err.message || "bad request");
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    log(`Port ${PORT} is already in use — another DiscordRP instance is probably running.`);
    process.exit(0);
  }
  log("Server error:", err.message);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  log(`Listening on http://${HOST}:${PORT}/presence`);
  log(`Config/base dir: ${baseDir}`);
  log("Waiting for Roblox Studio… (presence stays clear until Studio heartbeats)");
  connectDiscord().catch(() => {});
});

process.on("SIGINT", async () => {
  await clearPresence("shutdown");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await clearPresence("shutdown");
  process.exit(0);
});
