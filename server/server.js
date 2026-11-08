import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import {
  createGame,
  placeTile,
  placeMeeple,
  undoPlace,
  meepleOptions,
  currentPlayer,
  serializeGame,
  GameError,
  MAX_PLAYERS,
} from "../shared/game.js";
import { chooseMove, BOT_LEVELS } from "./bot.js";

const PORT = Number(process.env.PORT) || 3456;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const SHARED_DIR = path.join(ROOT, "shared");

const THEMES = ["classic", "horror", "xmas", "game"];
const COLORS = [
  "#e53935",
  "#1e88e5",
  "#43a047",
  "#fdd835",
  "#8e24aa",
  "#fb8c00",
];
const BOT_NAMES = [
  "Robo-Rik",
  "Bot-Bea",
  "Chip",
  "Byte-Bram",
  "Pixel-Pien",
  "Turbo-Tess",
  "Servo-Sam",
];
const BOT_SPEEDS = { fast: 250, normal: 800, slow: 1600 };
const ROOM_TTL_MS = 30 * 60 * 1000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

// ---------- Static files ----------

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  const [baseDir, rel] = urlPath.startsWith("/shared/")
    ? [SHARED_DIR, urlPath.slice("/shared/".length)]
    : [PUBLIC_DIR, urlPath === "/" ? "index.html" : urlPath.slice(1)];
  const file = path.resolve(baseDir, rel);
  if (!file.startsWith(baseDir + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" }).end("Niet gevonden");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
      // Mobile browsers otherwise keep stale ES modules after an update.
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(data);
  });
});

// ---------- Rooms ----------

const rooms = new Map();

function makeCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code;
  do {
    code = Array.from(
      { length: 4 },
      () => letters[crypto.randomInt(letters.length)],
    ).join("");
  } while (rooms.has(code));
  return code;
}

const newId = () => crypto.randomBytes(4).toString("hex");
const cleanName = (name) =>
  String(name ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20) || "Speler";

function freeColor(room) {
  return COLORS.find((c) => !room.players.some((p) => p.color === c));
}

function addHuman(room, ws, name) {
  const player = {
    id: newId(),
    token: crypto.randomUUID(),
    name: cleanName(name),
    color: freeColor(room),
    bot: null,
    connected: true,
    ws,
  };
  room.players.push(player);
  attach(ws, room, player);
  return player;
}

function attach(ws, room, player) {
  if (player.ws && player.ws !== ws) player.ws.close(4000, "Elders verbonden");
  player.ws = ws;
  player.connected = true;
  ws.room = room;
  ws.player = player;
  room.touched = Date.now();
  send(ws, {
    type: "joined",
    code: room.code,
    id: player.id,
    token: player.token,
    name: player.name,
  });
}

function send(ws, msg) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function roomState(room) {
  return {
    type: "state",
    code: room.code,
    hostId: room.hostId,
    theme: room.theme,
    botSpeed: room.botSpeed,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      bot: p.bot,
      connected: p.bot ? true : p.connected,
    })),
    game: room.game ? serializeGame(room.game) : null,
  };
}

function broadcast(room) {
  const msg = JSON.stringify(roomState(room));
  for (const p of room.players)
    if (p.ws && p.ws.readyState === p.ws.OPEN) p.ws.send(msg);
}

function requireHost(ws) {
  if (ws.room.hostId !== ws.player.id)
    throw new GameError("Alleen de host kan dit doen");
}

function requireLobby(room) {
  if (room.game && !room.game.finished)
    throw new GameError("Het spel is al bezig");
}

// ---------- Bots ----------

function needsAutoplay(room) {
  const g = room.game;
  if (!g || g.finished) return null;
  const p = room.players.find((pl) => pl.id === currentPlayer(g).id);
  if (p.bot) return p;
  return p.connected ? null : p;
}

function scheduleBot(room) {
  if (room.botTimer || !needsAutoplay(room)) return;
  room.botTimer = setTimeout(() => {
    room.botTimer = null;
    try {
      botStep(room);
    } catch (err) {
      console.error("Bot-fout", err);
    }
  }, BOT_SPEEDS[room.botSpeed]);
}

function botStep(room) {
  const p = needsAutoplay(room);
  if (!p) return;
  const g = room.game;
  if (g.phase === "place") {
    const mv = chooseMove(g, p.bot || "normal");
    room.botPlan = mv;
    placeTile(g, p.id, mv.x, mv.y, mv.rot);
  } else if (g.phase === "meeple") {
    const fi = room.botPlan?.fi ?? null;
    room.botPlan = null;
    placeMeeple(
      g,
      p.id,
      fi !== null && meepleOptions(g).includes(fi) ? fi : null,
    );
  }
  room.touched = Date.now();
  broadcast(room);
  scheduleBot(room);
}

// ---------- Messages ----------

const handlers = {
  create(ws, msg) {
    if (ws.room) throw new GameError("Je zit al in een kamer");
    const room = {
      code: makeCode(),
      hostId: null,
      players: [],
      game: null,
      theme: THEMES.includes(msg.theme) ? msg.theme : "classic",
      botSpeed: "normal",
      botTimer: null,
      botPlan: null,
      touched: Date.now(),
    };
    rooms.set(room.code, room);
    room.hostId = addHuman(room, ws, msg.name).id;
    broadcast(room);
  },

  join(ws, msg) {
    if (ws.room) throw new GameError("Je zit al in een kamer");
    const room = rooms.get(
      String(msg.code ?? "")
        .toUpperCase()
        .trim(),
    );
    if (!room) throw new GameError("Kamer niet gevonden");
    const existing =
      msg.token && room.players.find((p) => p.token === msg.token);
    if (existing) {
      attach(ws, room, existing);
    } else {
      requireLobby(room);
      if (room.players.length >= MAX_PLAYERS)
        throw new GameError("De kamer is vol");
      addHuman(room, ws, msg.name);
    }
    broadcast(room);
    scheduleBot(room);
  },

  addBot(ws, msg) {
    requireHost(ws);
    const room = ws.room;
    requireLobby(room);
    if (room.players.length >= MAX_PLAYERS)
      throw new GameError("De kamer is vol");
    const level = BOT_LEVELS.includes(msg.level) ? msg.level : "normal";
    const name =
      BOT_NAMES.find((n) => !room.players.some((p) => p.name === n)) ||
      `Bot ${room.players.length}`;
    room.players.push({
      id: newId(),
      token: null,
      name,
      color: freeColor(room),
      bot: level,
      connected: true,
      ws: null,
    });
    broadcast(room);
  },

  kick(ws, msg) {
    requireHost(ws);
    const room = ws.room;
    requireLobby(room);
    const p = room.players.find((pl) => pl.id === msg.id);
    if (!p || p.id === room.hostId) return;
    room.players = room.players.filter((pl) => pl !== p);
    if (p.ws) {
      send(p.ws, { type: "kicked" });
      p.ws.room = null;
      p.ws.player = null;
    }
    broadcast(room);
  },

  settings(ws, msg) {
    requireHost(ws);
    if (THEMES.includes(msg.theme)) ws.room.theme = msg.theme;
    if (msg.botSpeed in BOT_SPEEDS) ws.room.botSpeed = msg.botSpeed;
    broadcast(ws.room);
  },

  start(ws) {
    requireHost(ws);
    const room = ws.room;
    requireLobby(room);
    if (room.players.length < 2)
      throw new GameError(
        "Je hebt minstens 2 spelers nodig (voeg een bot toe)",
      );
    room.game = createGame(room.players);
    broadcast(room);
    scheduleBot(room);
  },

  place(ws, msg) {
    const g = requireGame(ws);
    placeTile(g, ws.player.id, msg.x, msg.y, msg.rot);
    broadcast(ws.room);
  },

  undo(ws) {
    const g = requireGame(ws);
    undoPlace(g, ws.player.id);
    broadcast(ws.room);
  },

  meeple(ws, msg) {
    const g = requireGame(ws);
    placeMeeple(g, ws.player.id, Number.isInteger(msg.fi) ? msg.fi : null);
    broadcast(ws.room);
    scheduleBot(ws.room);
  },

  toLobby(ws) {
    requireHost(ws);
    if (!ws.room.game?.finished) throw new GameError("Het spel is nog bezig");
    ws.room.game = null;
    broadcast(ws.room);
  },

  leave(ws) {
    const { room, player } = ws;
    if (!room) return;
    ws.room = null;
    ws.player = null;
    if (room.game && !room.game.finished) {
      player.connected = false;
      player.ws = null;
    } else {
      room.players = room.players.filter((p) => p !== player);
    }
    handOverHost(room);
    broadcast(room);
    scheduleBot(room);
  },
};

function requireGame(ws) {
  const g = ws.room?.game;
  if (!g) throw new GameError("Er is geen spel bezig");
  ws.room.touched = Date.now();
  return g;
}

function handOverHost(room) {
  const host = room.players.find((p) => p.id === room.hostId);
  if (host && host.connected) return;
  const next = room.players.find((p) => !p.bot && p.connected);
  if (next) room.hostId = next.id;
}

const wss = new WebSocketServer({ server, maxPayload: 4096 });

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const handler = Object.hasOwn(handlers, msg?.type)
      ? handlers[msg.type]
      : null;
    if (!handler) return;
    if (!ws.room && !["create", "join"].includes(msg.type)) return;
    try {
      handler(ws, msg);
    } catch (err) {
      if (!(err instanceof GameError)) console.error(err);
      send(ws, {
        type: "error",
        message: err instanceof GameError ? err.message : "Er ging iets mis",
        joinFailed: msg.type === "join",
      });
    }
  });

  ws.on("close", () => {
    const { room, player } = ws;
    if (!room || !player || player.ws !== ws) return;
    player.connected = false;
    player.ws = null;
    handOverHost(room);
    broadcast(room);
    scheduleBot(room);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const anyone = room.players.some((p) => !p.bot && p.connected);
    if (!anyone && now - room.touched > ROOM_TTL_MS) {
      clearTimeout(room.botTimer);
      rooms.delete(code);
    }
  }
}, 60 * 1000).unref();

server.listen(PORT, () => {
  console.log(`Carcassonne draait op http://localhost:${PORT}`);
});
