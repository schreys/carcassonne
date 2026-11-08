import { featurePos, TILES } from "/shared/game.js";
import {
  THEMES,
  tileImage,
  drawMeeple,
  drawBackground,
  drawForeground,
  clearTileCache,
} from "./themes.js";

const $ = (id) => document.getElementById(id);
const TS = 96;
const SESSION_KEY = "carc.session";

let ws = null;
let pending = null;
let me = loadSession();
let state = null;
let homeTheme = THEMES[localStorage.getItem("carc.theme")]
  ? localStorage.getItem("carc.theme")
  : "classic";
let localTheme = "";
let appliedTheme = null;
let rot = 0;
let hover = null;
// Touch: cell chosen with a first tap, placed on second tap or confirm.
let selected = null;
let mouseWorld = null;
const coarse = matchMedia("(pointer: coarse)").matches;
let endDismissed = false;
let lastEventId = 0;
let logEvents = [];
const floaters = [];
const cam = { x: 0, y: 0, z: 1 };

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

function saveSession(s) {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
}

const themeId = () => localTheme || state?.theme || homeTheme;
const th = () => THEMES[themeId()];
const game = () => state?.game;
const roomPlayer = (id) => state?.players.find((p) => p.id === id);
const playerName = (id) => roomPlayer(id)?.name ?? "?";
const playerColor = (id) => roomPlayer(id)?.color ?? "#999";
const isHost = () => state && me && state.hostId === me.id;
const currentId = () => game()?.players[game().turn]?.id;
const myTurn = () => game() && !game().finished && currentId() === me?.id;

// ---------- Networking ----------

function connect() {
  ws = new WebSocket(
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`,
  );
  ws.onopen = () => {
    if (me?.code)
      ws.send(
        JSON.stringify({
          type: "join",
          code: me.code,
          token: me.token,
          name: me.name,
        }),
      );
    else if (pending) ws.send(JSON.stringify(pending));
    pending = null;
  };
  ws.onmessage = (e) => onMessage(JSON.parse(e.data));
  ws.onclose = (e) => {
    if (e.code === 4000) {
      toast("Je bent in een ander tabblad verbonden");
      return;
    }
    setTimeout(connect, 1500);
  };
}

function send(msg) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  else pending = msg;
}

function onMessage(msg) {
  switch (msg.type) {
    case "joined":
      me = { id: msg.id, token: msg.token, code: msg.code, name: msg.name };
      saveSession(me);
      history.replaceState(null, "", `?room=${msg.code}`);
      break;
    case "state":
      onState(msg);
      break;
    case "error":
      toast(msg.message);
      if (msg.joinFailed) resetToHome();
      break;
    case "kicked":
      toast("Je bent uit de kamer verwijderd");
      resetToHome();
      break;
  }
}

function resetToHome() {
  me = null;
  state = null;
  saveSession(null);
  history.replaceState(null, "", location.pathname);
  render();
}

function onState(next) {
  const hadGame = !!state?.game;
  state = next;
  const g = state.game;
  const needFit = g && !hadGame;
  let follow = null;
  if (needFit) {
    logEvents = [];
    lastEventId = 0;
    endDismissed = false;
  }
  if (g) {
    for (const ev of g.events) {
      if (ev.id <= lastEventId) continue;
      if (ev.kind === "place" && hadGame) follow = ev;
      if (ev.kind !== "place") logEvents.push(ev);
      if (ev.kind === "score" && hadGame) spawnFloater(ev);
    }
    lastEventId = g.events.at(-1)?.id ?? lastEventId;
    logEvents = logEvents.slice(-60);
  }
  render();
  if (needFit) fitBoard();
  else if (follow) followTile(follow.x, follow.y);
  if (afterUndo && myTurn() && g?.phase === "place") restoreAfterUndo();
}

// Set when the player takes a tile back; re-selects it (or the clicked cell) once the server confirms.
let afterUndo = null;

function undoTile(clickedCell = null) {
  const g = game();
  const tile = g.board.find(
    (b) => b.x === g.lastPlaced.x && b.y === g.lastPlaced.y,
  );
  afterUndo = { cell: clickedCell, back: [tile.x, tile.y], rot: tile.rot };
  send({ type: "undo" });
}

function restoreAfterUndo() {
  const { cell, back, rot: oldRot } = afterUndo;
  afterUndo = null;
  const canUse = (c) =>
    c && game().placements.some((p) => p.x === c[0] && p.y === c[1]);
  rot = oldRot;
  selected = canUse(cell) ? cell : back;
  hover = selected;
  if (!placeOk(selected)) rotate();
  else updatePlaceControls();
}

function spawnFloater(ev) {
  const t = game().board.find((b) => b.x === ev.at.x && b.y === ev.at.y);
  if (!t) return;
  const [px, py] = featurePos(t.type, t.rot, ev.at.fi);
  floaters.push({
    x: t.x * TS - TS / 2 + px * TS,
    y: t.y * TS - TS / 2 + py * TS,
    text: `+${ev.points}`,
    color: playerColor(ev.players[0]),
    born: performance.now(),
  });
}

// ---------- UI ----------

function applyTheme() {
  const id = themeId();
  if (id === appliedTheme) return;
  appliedTheme = id;
  const t = THEMES[id];
  const root = document.documentElement.style;
  root.setProperty("--bg", t.ui.bg);
  root.setProperty("--panel", t.ui.panel);
  root.setProperty("--text", t.ui.text);
  root.setProperty("--accent", t.ui.accent);
  root.setProperty("--font", t.ui.font);
  root.setProperty("--title-font", t.ui.titleFont);
  document.body.dataset.theme = id;
  $("subtitle").textContent = t.subtitle;
  for (const b of $("themePicker").children)
    b.classList.toggle("active", b.dataset.theme === homeTheme);
}

function show(id) {
  for (const s of ["home", "lobby", "game"])
    $(s).classList.toggle("hidden", s !== id);
}

function render() {
  applyTheme();
  const g = game();
  if (!state) show("home");
  else if (!g) show("lobby");
  else show("game");
  $("endOverlay").classList.toggle("hidden", !g?.finished || endDismissed);
  if (state && !g) renderLobby();
  if (g) renderGame();
  document.title = myTurn() ? "▶ Jouw beurt – Carcassonne" : "Carcassonne";
}

function el(tag, props = {}, children = []) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  for (const c of children) e.append(c);
  return e;
}

function dot(color) {
  const d = el("span", { className: "dot" });
  d.style.background = color;
  return d;
}

function renderLobby() {
  $("roomCode").textContent = state.code;
  const list = $("lobbyPlayers");
  list.replaceChildren(
    ...state.players.map((p) => {
      const badges = [];
      if (p.id === state.hostId) badges.push("👑 host");
      if (p.bot)
        badges.push(`🤖 ${p.bot === "easy" ? "makkelijk" : "normaal"}`);
      if (!p.connected) badges.push("offline");
      if (p.id === me?.id) badges.push("(jij)");
      const li = el("li", {}, [
        dot(p.color),
        el("span", { className: "name", textContent: p.name }),
        el("span", { className: "badge", textContent: badges.join(" · ") }),
      ]);
      if (isHost() && p.id !== state.hostId) {
        li.append(
          el("button", {
            className: "kick",
            textContent: "✕",
            title: "Verwijderen",
            onclick: () => send({ type: "kick", id: p.id }),
          }),
        );
      }
      return li;
    }),
  );
  $("hostControls").classList.toggle("hidden", !isHost());
  $("startBtn").classList.toggle("hidden", !isHost());
  $("playerCount").textContent = `(${state.players.length}/6)`;
  $("waitHost").classList.toggle("hidden", isHost());
  $("themeName").textContent = THEMES[state.theme].label;
  $("themeSelect").value = state.theme;
  $("botSpeed").value = state.botSpeed;
  $("startBtn").disabled = state.players.length < 2;
  $("addBot").disabled = state.players.length >= 6;
}

function renderGame() {
  const g = game();
  const t = th();
  const cur = roomPlayer(currentId());

  const banner = $("banner");
  banner.classList.toggle("mine", myTurn());
  if (g.finished) banner.textContent = "Spel afgelopen!";
  else if (myTurn())
    banner.textContent =
      g.phase === "place"
        ? `Jouw beurt — ${coarse ? "tik op een vak" : "leg je tegel"}`
        : `Plaats een ${t.names.meeple} of sla over`;
  else
    banner.textContent = `${cur?.name} is aan zet${cur?.bot ? " 🤖" : cur && !cur.connected ? " (afwezig, bot speelt)" : ""}…`;

  if (!(myTurn() && g.phase === "place")) selected = null;
  $("deckCount").textContent = `${g.deckCount} tegels in de stapel`;
  updatePlaceControls();

  const meepleTurn = myTurn() && g.phase === "meeple";
  $("meepleBox").classList.toggle("hidden", !meepleTurn);
  document.querySelector(".tile-box").classList.toggle("hidden", meepleTurn);
  if (meepleTurn) {
    const act = coarse ? "Tik" : "Klik";
    $("meepleHint").textContent = g.meepleOptions.length
      ? `${act} op een gloeiende plek voor een ${t.names.meeple}, op de tegel om over te slaan, of ernaast om terug te gaan.`
      : `Je kunt hier geen ${t.names.meeple} plaatsen. ${act} op de tegel om verder te gaan.`;
    $("skipMeeple").textContent =
      (g.meepleOptions.length ? `Geen ${t.names.meeple}` : "Beurt beëindigen") +
      (coarse ? "" : " (spatie)");
  }

  $("scoreList").replaceChildren(
    ...g.players.map((gp) => {
      const p = roomPlayer(gp.id);
      const li = el(
        "li",
        { className: gp.id === currentId() && !g.finished ? "current" : "" },
        [
          dot(p.color),
          el("span", {
            className: "name",
            textContent: `${p.name}${p.id === me?.id ? " (jij)" : ""}${p.bot ? " 🤖" : ""}`,
          }),
          el("span", {
            className: "badge",
            textContent: `♟×${gp.meeples}`,
            title: `${t.names.meeples} over`,
          }),
          el("span", { className: "score", textContent: gp.score }),
        ],
      );
      if (!p.connected) li.classList.add("offline");
      return li;
    }),
  );

  const sel = $("localTheme");
  sel.options[0].textContent = `Kamerthema (${THEMES[state.theme].label})`;
  sel.value = localTheme;

  const log = $("log");
  log.replaceChildren(
    ...logEvents.map((ev) => el("li", { textContent: describe(ev) })).reverse(),
  );

  if (g.finished) {
    const ranked = [...g.players].sort((a, b) => b.score - a.score);
    const medals = ["🥇", "🥈", "🥉"];
    $("ranking").replaceChildren(
      ...ranked.map((gp, i) => {
        const rank = ranked.findIndex((r) => r.score === gp.score);
        return el("li", {}, [
          el("span", { textContent: medals[rank] ?? `${rank + 1}.` }),
          dot(playerColor(gp.id)),
          el("span", { textContent: playerName(gp.id) }),
          el("span", { className: "score", textContent: `${gp.score} pt` }),
        ]);
      }),
    );
    $("toLobbyBtn").classList.toggle("hidden", !isHost());
    $("waitLobby").classList.toggle("hidden", isHost());
  }
}

function describe(ev) {
  const names = th().names;
  if (ev.kind === "score") {
    const who = ev.players.map(playerName).join(" & ");
    return ev.final
      ? `${who} +${ev.points} — ${names[ev.feature]} (eindtelling)`
      : `${who} +${ev.points} — ${names[ev.feature]} afgerond!`;
  }
  if (ev.kind === "discard") return "Een tegel paste nergens en is weggelegd";
  if (ev.kind === "end") return "🏁 Het spel is afgelopen!";
  return "";
}

function placeOk(cell) {
  return (
    !!cell &&
    game().placements.some(
      (p) => p.x === cell[0] && p.y === cell[1] && p.rot === rot,
    )
  );
}

function updatePlaceControls() {
  const active = myTurn() && game().phase === "place";
  $("rotateBtn").disabled = !active;
  $("confirmPlace").classList.toggle("hidden", !active || !selected);
  $("confirmPlace").disabled = !placeOk(selected);
  $("pendingActions").classList.toggle("hidden", !active || !selected);
  $("pendConfirm").disabled = !placeOk(selected);
  if (active)
    $("banner").textContent = selected
      ? `${coarse ? "Tik" : "Klik"} om te draaien · ✓ om te leggen`
      : `Jouw beurt — ${coarse ? "tik op een vak" : "klik op een vak"}`;
  drawPreview();
}

// Keeps the floating ↻/✓ buttons just below (or above) the pending tile.
function positionPendingActions() {
  if (!selected) return;
  const box = $("pendingActions");
  const sx = (selected[0] * TS - cam.x) * cam.z + W / 2;
  const half = (TS * cam.z) / 2;
  const cy = (selected[1] * TS - cam.y) * cam.z + H / 2;
  let top = cy + half + 10;
  if (top + box.offsetHeight > visibleRect().bottom - 8)
    top = cy - half - 10 - box.offsetHeight;
  box.style.left = `${sx}px`;
  box.style.top = `${top}px`;
}

function placeAt([x, y]) {
  send({ type: "place", x, y, rot });
  rot = 0;
  selected = null;
  hover = null;
}

function drawPreview() {
  const c = $("tilePreview");
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  const g = game();
  if (!g?.current) return;
  const r = myTurn() ? rot : 0;
  ctx.drawImage(
    tileImage(themeId(), g.current, r),
    5,
    5,
    c.width - 10,
    c.height - 10,
  );
}

let toastTimer = null;
function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3000);
}

// ---------- Board canvas ----------

const canvas = $("board");
const ctx = canvas.getContext("2d");
let W = 0,
  H = 0,
  dpr = 1;

function resize() {
  dpr = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
}

function screenToWorld(sx, sy) {
  return [(sx - W / 2) / cam.z + cam.x, (sy - H / 2) / cam.z + cam.y];
}

function worldToCell(wx, wy) {
  return [Math.round(wx / TS), Math.round(wy / TS)];
}

function visibleRect() {
  const phone = W <= 760;
  const sheetH = phone ? $("sidebar").offsetHeight : 0;
  return {
    left: 0,
    top: 60,
    right: phone ? W : W - 310,
    bottom: H - sheetH,
  };
}

function fitBoard() {
  camAnim = null;
  const b = game()?.board;
  if (!b?.length) return;
  const xs = b.map((t) => t.x),
    ys = b.map((t) => t.y);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const r = visibleRect();
  const fit = Math.min(
    (r.right - r.left) / ((maxX - minX + 3) * TS),
    (r.bottom - r.top) / ((maxY - minY + 3) * TS),
  );
  cam.z = Math.max(0.3, Math.min(W <= 760 ? 0.9 : 1.4, fit));
  cam.x = ((minX + maxX) / 2) * TS - ((r.left + r.right) / 2 - W / 2) / cam.z;
  cam.y = ((minY + maxY) / 2) * TS - ((r.top + r.bottom) / 2 - H / 2) / cam.z;
}

let camAnim = null;

// Pan smoothly to a tile when it lands outside the visible area.
function followTile(x, y) {
  const r = visibleRect();
  const sx = (x * TS - cam.x) * cam.z + W / 2;
  const sy = (y * TS - cam.y) * cam.z + H / 2;
  const m = (TS * cam.z) / 2;
  if (
    sx - m >= r.left &&
    sx + m <= r.right &&
    sy - m >= r.top &&
    sy + m <= r.bottom
  )
    return;
  camAnim = {
    fx: cam.x,
    fy: cam.y,
    tx: x * TS - ((r.left + r.right) / 2 - W / 2) / cam.z,
    ty: y * TS - ((r.top + r.bottom) / 2 - H / 2) / cam.z,
    t0: performance.now(),
  };
}

function stepCamera(now) {
  if (!camAnim) return;
  const t = Math.min(1, (now - camAnim.t0) / 400);
  const e = 1 - (1 - t) ** 3;
  cam.x = camAnim.fx + (camAnim.tx - camAnim.fx) * e;
  cam.y = camAnim.fy + (camAnim.ty - camAnim.fy) * e;
  if (t === 1) camAnim = null;
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function variantOf(x, y) {
  const h = Math.abs((x * 73856093) ^ (y * 19349663));
  return h % 4;
}

const isField = (type, fi) => TILES[type].features[fi].type === "field";

function frame(now) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const tid = themeId();
  stepCamera(now);
  drawBackground(ctx, tid, W, H, now);
  if (game()) drawBoard(now, tid);
  drawForeground(ctx, tid, W, H, now);
  positionPendingActions();
  requestAnimationFrame(frame);
}

function drawBoard(now, tid) {
  const g = game();
  const t = THEMES[tid];
  ctx.save();
  ctx.translate(W / 2 - cam.x * cam.z, H / 2 - cam.y * cam.z);
  ctx.scale(cam.z, cam.z);

  ctx.fillStyle = "#000";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 18;
  for (const tile of g.board)
    ctx.fillRect(tile.x * TS - TS / 2, tile.y * TS - TS / 2, TS, TS);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  for (const tile of g.board) {
    ctx.drawImage(
      tileImage(tid, tile.type, tile.rot, variantOf(tile.x, tile.y)),
      tile.x * TS - TS / 2,
      tile.y * TS - TS / 2,
      TS,
      TS,
    );
  }

  if (
    g.lastPlaced &&
    !(g.lastPlaced.x === 0 && g.lastPlaced.y === 0 && g.board.length === 1)
  ) {
    ctx.strokeStyle =
      g.phase === "meeple" ? playerColor(currentId()) : "rgba(255,255,255,0.8)";
    ctx.lineWidth = 3 / Math.min(1, cam.z);
    ctx.strokeRect(
      g.lastPlaced.x * TS - TS / 2 + 1.5,
      g.lastPlaced.y * TS - TS / 2 + 1.5,
      TS - 3,
      TS - 3,
    );
  }

  if (myTurn() && g.phase === "place") {
    const seen = new Set();
    ctx.setLineDash([8, 6]);
    for (const p of g.placements) {
      const k = `${p.x},${p.y}`;
      if (seen.has(k)) continue;
      seen.add(k);
      roundRect(
        p.x * TS - TS / 2 + 4,
        p.y * TS - TS / 2 + 4,
        TS - 8,
        TS - 8,
        10,
      );
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.setLineDash([]);
    const ghost = selected ?? hover;
    if (ghost && seen.has(`${ghost[0]},${ghost[1]}`)) {
      const ok = placeOk(ghost);
      ctx.globalAlpha = selected ? 1 : ok ? 0.85 : 0.55;
      ctx.drawImage(
        tileImage(tid, g.current, rot),
        ghost[0] * TS - TS / 2,
        ghost[1] * TS - TS / 2,
        TS,
        TS,
      );
      ctx.globalAlpha = 1;
      ctx.strokeStyle = ok ? "#2ecc71" : "#e74c3c";
      ctx.lineWidth = selected ? 5 + Math.sin(now / 200) * 1.5 : 4;
      ctx.strokeRect(ghost[0] * TS - TS / 2, ghost[1] * TS - TS / 2, TS, TS);
    }
  }

  for (const tile of g.board) {
    for (const m of tile.meeples) {
      const [px, py] = featurePos(tile.type, tile.rot, m.fi);
      drawMeeple(
        ctx,
        t.meeple,
        tile.x * TS - TS / 2 + px * TS,
        tile.y * TS - TS / 2 + py * TS,
        TS * 0.3,
        playerColor(m.player),
        isField(tile.type, m.fi),
      );
    }
  }

  if (myTurn() && g.phase === "meeple") {
    const tile = g.board.find(
      (b) => b.x === g.lastPlaced.x && b.y === g.lastPlaced.y,
    );
    const hoverFi = meepleAt(mouseWorld);
    const pulse = 1 + 0.15 * Math.sin(now / 200);
    for (const fi of g.meepleOptions) {
      const [px, py] = featurePos(tile.type, tile.rot, fi);
      const x = tile.x * TS - TS / 2 + px * TS,
        y = tile.y * TS - TS / 2 + py * TS;
      if (fi === hoverFi) {
        ctx.globalAlpha = 0.8;
        drawMeeple(
          ctx,
          t.meeple,
          x,
          y,
          TS * 0.3,
          playerColor(me.id),
          isField(tile.type, fi),
        );
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.beginPath();
      ctx.arc(x, y, TS * 0.09 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = playerColor(me.id) + "aa";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
    }
  }

  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    const age = (now - f.born) / 1800;
    if (age >= 1) {
      floaters.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = 1 - age * age;
    ctx.font = `bold ${30}px ${t.ui.titleFont}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#000";
    ctx.strokeText(f.text, f.x, f.y - age * 50);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y - age * 50);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function meepleAt(world) {
  const g = game();
  if (!world || !myTurn() || g.phase !== "meeple") return null;
  const tile = g.board.find(
    (b) => b.x === g.lastPlaced.x && b.y === g.lastPlaced.y,
  );
  let best = null,
    bestD = Math.max(TS * 0.22, 26 / cam.z);
  for (const fi of g.meepleOptions) {
    const [px, py] = featurePos(tile.type, tile.rot, fi);
    const d = Math.hypot(
      world[0] - (tile.x * TS - TS / 2 + px * TS),
      world[1] - (tile.y * TS - TS / 2 + py * TS),
    );
    if (d < bestD) {
      bestD = d;
      best = fi;
    }
  }
  return best;
}

function rotate() {
  const g = game();
  if (!myTurn() || g.phase !== "place") return;
  const cell = selected ?? hover;
  const valid = cell
    ? g.placements
        .filter((p) => p.x === cell[0] && p.y === cell[1])
        .map((p) => p.rot)
    : [];
  if (selected && valid.length === 1 && valid[0] === rot) {
    toast("Deze tegel past hier maar op één manier");
  } else if (valid.length) {
    rot = valid
      .map((r) => [r, (r - rot + 3) % 4])
      .sort((a, b) => a[1] - b[1])[0][0];
  } else {
    rot = (rot + 1) % 4;
  }
  updatePlaceControls();
}

function onBoardClick(sx, sy, touch) {
  const g = game();
  if (!myTurn()) return;
  const world = screenToWorld(sx, sy);
  if (g.phase === "place") {
    const cell = worldToCell(...world);
    const valid = g.placements.some((p) => p.x === cell[0] && p.y === cell[1]);
    if (!valid) {
      selected = null;
      updatePlaceControls();
      return;
    }
    hover = cell;
    if (selected?.[0] === cell[0] && selected?.[1] === cell[1]) {
      rotate();
      return;
    }
    selected = cell;
    if (placeOk(cell)) updatePlaceControls();
    else rotate();
  } else if (g.phase === "meeple") {
    const fi = meepleAt(world);
    const cell = worldToCell(...world);
    if (fi !== null) send({ type: "meeple", fi });
    else if (cell[0] === g.lastPlaced.x && cell[1] === g.lastPlaced.y)
      send({ type: "meeple", fi: null });
    else undoTile(cell);
  }
}

const pointers = new Map();
let drag = null;
let pinch = null;

function pinchInfo() {
  const [a, b] = [...pointers.values()];
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    d: Math.hypot(a.x - b.x, a.y - b.y) || 1,
  };
}

canvas.addEventListener("pointerdown", (e) => {
  if (e.button === 2) return;
  camAnim = null;
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {}
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    drag = null;
    pinch = pinchInfo();
  } else if (pointers.size === 1) {
    drag = { sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, moved: false };
  }
});
canvas.addEventListener("pointermove", (e) => {
  if (e.pointerType === "mouse") {
    mouseWorld = screenToWorld(e.clientX, e.clientY);
    hover = worldToCell(...mouseWorld);
  }
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2) {
    const p = pinchInfo();
    zoomAt(p.x, p.y, p.d / pinch.d);
    cam.x -= (p.x - pinch.x) / cam.z;
    cam.y -= (p.y - pinch.y) / cam.z;
    pinch = p;
    return;
  }
  if (!drag) return;
  const dx = e.clientX - drag.sx,
    dy = e.clientY - drag.sy;
  if (Math.hypot(dx, dy) > (e.pointerType === "mouse" ? 5 : 10))
    drag.moved = true;
  if (drag.moved) {
    cam.x = drag.cx - dx / cam.z;
    cam.y = drag.cy - dy / cam.z;
    canvas.style.cursor = "grabbing";
  }
});
function endPointer(e) {
  const tap =
    e.type === "pointerup" && drag && !drag.moved && pointers.size === 1;
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (tap && game())
    onBoardClick(e.clientX, e.clientY, e.pointerType !== "mouse");
  if (!pointers.size) {
    drag = null;
    canvas.style.cursor = "";
  }
}
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("pointerleave", (e) => {
  if (e.pointerType !== "mouse") return;
  mouseWorld = null;
  hover = null;
});
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  rotate();
});
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 1 / 1.1);
  },
  { passive: false },
);

function zoomAt(sx, sy, factor) {
  camAnim = null;
  const [wx, wy] = screenToWorld(sx, sy);
  cam.z = Math.max(0.25, Math.min(2.5, cam.z * factor));
  cam.x = wx - (sx - W / 2) / cam.z;
  cam.y = wy - (sy - H / 2) / cam.z;
}

window.addEventListener("keydown", (e) => {
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLSelectElement
  )
    return;
  const g = game();
  if (!g) return;
  if (e.key === "r" || e.key === "R") rotate();
  if (myTurn() && g.phase === "place" && selected) {
    if ((e.key === " " || e.key === "Enter") && placeOk(selected)) {
      e.preventDefault();
      placeAt(selected);
    } else if (e.key === "Escape") {
      selected = null;
      updatePlaceControls();
    }
  }
  if (
    (e.key === " " || e.key === "Enter") &&
    myTurn() &&
    g.phase === "meeple"
  ) {
    e.preventDefault();
    send({ type: "meeple", fi: null });
  }
  if (
    (e.key === "Escape" || e.key === "Backspace") &&
    myTurn() &&
    g.phase === "meeple"
  )
    undoTile();
});

// ---------- Controls ----------

for (const [id, t] of Object.entries(THEMES)) {
  const b = el(
    "button",
    {
      onclick: () => {
        homeTheme = id;
        localStorage.setItem("carc.theme", id);
        render();
        for (const btn of $("themePicker").children)
          btn.classList.toggle("active", btn.dataset.theme === id);
      },
    },
    [el("span", { textContent: t.emoji }), t.label],
  );
  b.dataset.theme = id;
  $("themePicker").append(b);
  $("themeSelect").append(
    el("option", { value: id, textContent: `${t.emoji} ${t.label}` }),
  );
}
$("localTheme").append(el("option", { value: "", textContent: "Kamerthema" }));
for (const [id, t] of Object.entries(THEMES))
  $("localTheme").append(
    el("option", { value: id, textContent: `${t.emoji} ${t.label}` }),
  );

$("nameInput").value = localStorage.getItem("carc.name") || "";
const playerNameInput = () => {
  const name = $("nameInput").value.trim();
  if (!name) {
    toast("Vul eerst je naam in");
    $("nameInput").focus();
    return null;
  }
  localStorage.setItem("carc.name", name);
  return name;
};

$("createBtn").onclick = () => {
  const name = playerNameInput();
  if (name) send({ type: "create", name, theme: homeTheme });
};
$("joinBtn").onclick = () => {
  const name = playerNameInput();
  const code = $("codeInput").value.trim().toUpperCase();
  if (!name) return;
  if (code.length !== 4) {
    toast("Vul een code van 4 letters in");
    return;
  }
  send({ type: "join", code, name });
};
$("codeInput").addEventListener(
  "keydown",
  (e) => e.key === "Enter" && $("joinBtn").click(),
);
$("copyLink").onclick = async () => {
  const link = `${location.origin}/?room=${state.code}`;
  try {
    await navigator.clipboard.writeText(link);
    toast("Link gekopieerd!");
  } catch {
    toast(link);
  }
};
if (navigator.share) {
  $("shareLink").classList.remove("hidden");
  $("shareLink").onclick = () =>
    navigator
      .share({
        title: "Carcassonne",
        text: `Doe mee met mijn Carcassonne-spel! Code: ${state.code}`,
        url: `${location.origin}/?room=${state.code}`,
      })
      .catch(() => {});
}
$("addBot").onclick = () =>
  send({ type: "addBot", level: $("botLevel").value });
$("themeSelect").onchange = (e) =>
  send({ type: "settings", theme: e.target.value });
$("botSpeed").onchange = (e) =>
  send({ type: "settings", botSpeed: e.target.value });
$("startBtn").onclick = () => send({ type: "start" });
$("leaveBtn").onclick = () => {
  send({ type: "leave" });
  resetToHome();
};
$("leaveGame").onclick = () => {
  if (
    !confirm(
      "Weet je zeker dat je het spel wilt verlaten? Een bot neemt je plaats over.",
    )
  )
    return;
  send({ type: "leave" });
  resetToHome();
};
$("rotateBtn").onclick = rotate;
$("pendRotate").onclick = rotate;
$("pendConfirm").onclick = () => placeOk(selected) && placeAt(selected);
$("confirmPlace").onclick = () => placeOk(selected) && placeAt(selected);
$("sheetToggle").onclick = () => $("sidebar").classList.toggle("open");
new ResizeObserver(() =>
  document.documentElement.style.setProperty(
    "--sheet-h",
    `${$("sidebar").offsetHeight}px`,
  ),
).observe($("sidebar"));
if (coarse)
  $("helpText").textContent =
    "Sleep om te verschuiven · knijp om te zoomen · tik op de tegel om te draaien, ✓ om te leggen";
$("skipMeeple").onclick = () => send({ type: "meeple", fi: null });
$("undoTile").onclick = () => undoTile();
$("localTheme").onchange = (e) => {
  localTheme = e.target.value;
  render();
};
$("toLobbyBtn").onclick = () => send({ type: "toLobby" });
$("viewBoard").onclick = () => {
  endDismissed = true;
  render();
};
$("zoomIn").onclick = () => zoomAt(W / 2, H / 2, 1.2);
$("zoomOut").onclick = () => zoomAt(W / 2, H / 2, 1 / 1.2);
$("centerBtn").onclick = fitBoard;

window.addEventListener("resize", resize);
document.fonts?.ready.then(() => clearTileCache());

// ---------- Boot ----------

const params = new URLSearchParams(location.search);
const roomParam = params.get("room")?.toUpperCase();
if (roomParam && me?.code !== roomParam) {
  me = null;
  $("codeInput").value = roomParam;
}
resize();
render();
connect();
requestAnimationFrame(frame);
