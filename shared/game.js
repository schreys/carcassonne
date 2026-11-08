// Shared Carcassonne rules (used by server, bots and browser).
// Sides: 0 = N, 1 = E, 2 = S, 3 = W. Rotation is clockwise in quarter turns.

export const DIRS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
export const opp = (s) => (s + 2) % 4;
export const key = (x, y) => `${x},${y}`;
const partKey = (x, y, fi) => `${x},${y},${fi}`;

export const START_TILE = "D";
export const MAX_PLAYERS = 6;
export const MEEPLES_PER_PLAYER = 7;

const city = (sides, shield = false) => ({ type: "city", sides, shield });
const road = (...sides) => ({ type: "road", sides });
const monastery = () => ({ type: "monastery", sides: [] });
// Field ports: two per edge, clockwise from the NW corner (N-left=0, N-right=1, E-top=2 ... W-top=7).
// pos = meeple spot in the unrotated tile, cities = adjacent city feature indices.
const field = (ports, pos, cities = []) => ({
  type: "field",
  sides: [],
  ports,
  pos,
  cities,
});
const ALL_PORTS = [0, 1, 2, 3, 4, 5, 6, 7];
const OPP_PORT = [5, 4, 7, 6, 1, 0, 3, 2];

// Base game tile set (72 tiles). edges = N E S W with C = city, R = road, F = field.
export const TILES = {
  A: {
    edges: "FFRF",
    count: 2,
    features: [monastery(), road(2), field(ALL_PORTS, [0.8, 0.2])],
  },
  B: {
    edges: "FFFF",
    count: 4,
    features: [monastery(), field(ALL_PORTS, [0.8, 0.2])],
  },
  C: { edges: "CCCC", count: 1, features: [city([0, 1, 2, 3], true)] },
  D: {
    edges: "CRFR",
    count: 4,
    features: [
      city([0]),
      road(1, 3),
      field([7, 2], [0.82, 0.36], [0]),
      field([3, 4, 5, 6], [0.5, 0.8]),
    ],
  },
  E: {
    edges: "CFFF",
    count: 5,
    features: [city([0]), field([2, 3, 4, 5, 6, 7], [0.5, 0.7], [0])],
  },
  F: {
    edges: "FCFC",
    count: 2,
    features: [
      city([1, 3], true),
      field([0, 1], [0.5, 0.07], [0]),
      field([4, 5], [0.5, 0.93], [0]),
    ],
  },
  G: {
    edges: "FCFC",
    count: 1,
    features: [
      city([1, 3]),
      field([0, 1], [0.5, 0.07], [0]),
      field([4, 5], [0.5, 0.93], [0]),
    ],
  },
  H: {
    edges: "FCFC",
    count: 3,
    features: [city([1]), city([3]), field([0, 1, 4, 5], [0.5, 0.5], [0, 1])],
  },
  I: {
    edges: "CCFF",
    count: 2,
    features: [city([0]), city([1]), field([4, 5, 6, 7], [0.3, 0.7], [0, 1])],
  },
  J: {
    edges: "CRRF",
    count: 3,
    features: [
      city([0]),
      road(1, 2),
      field([3, 4], [0.86, 0.86]),
      field([2, 5, 6, 7], [0.25, 0.62], [0]),
    ],
  },
  K: {
    edges: "CFRR",
    count: 3,
    features: [
      city([0]),
      road(2, 3),
      field([5, 6], [0.14, 0.86]),
      field([2, 3, 4, 7], [0.75, 0.62], [0]),
    ],
  },
  L: {
    edges: "CRRR",
    count: 3,
    features: [
      city([0]),
      road(1),
      road(2),
      road(3),
      field([7, 2], [0.32, 0.34], [0]),
      field([3, 4], [0.8, 0.8]),
      field([5, 6], [0.2, 0.8]),
    ],
  },
  M: {
    edges: "CFFC",
    count: 2,
    features: [city([0, 3], true), field([2, 3, 4, 5], [0.8, 0.8], [0])],
  },
  N: {
    edges: "CFFC",
    count: 3,
    features: [city([0, 3]), field([2, 3, 4, 5], [0.8, 0.8], [0])],
  },
  O: {
    edges: "CRRC",
    count: 2,
    features: [
      city([0, 3], true),
      road(1, 2),
      field([3, 4], [0.88, 0.88]),
      field([2, 5], [0.88, 0.24], [0]),
    ],
  },
  P: {
    edges: "CRRC",
    count: 3,
    features: [
      city([0, 3]),
      road(1, 2),
      field([3, 4], [0.88, 0.88]),
      field([2, 5], [0.88, 0.24], [0]),
    ],
  },
  Q: {
    edges: "CCFC",
    count: 1,
    features: [city([0, 1, 3], true), field([4, 5], [0.5, 0.92], [0])],
  },
  R: {
    edges: "CCFC",
    count: 3,
    features: [city([0, 1, 3]), field([4, 5], [0.5, 0.92], [0])],
  },
  S: {
    edges: "CCRC",
    count: 2,
    features: [
      city([0, 1, 3], true),
      road(2),
      field([4], [0.78, 0.9], [0]),
      field([5], [0.22, 0.9], [0]),
    ],
  },
  T: {
    edges: "CCRC",
    count: 1,
    features: [
      city([0, 1, 3]),
      road(2),
      field([4], [0.78, 0.9], [0]),
      field([5], [0.22, 0.9], [0]),
    ],
  },
  U: {
    edges: "RFRF",
    count: 8,
    features: [
      road(0, 2),
      field([1, 2, 3, 4], [0.8, 0.5]),
      field([5, 6, 7, 0], [0.2, 0.5]),
    ],
  },
  V: {
    edges: "FFRR",
    count: 9,
    features: [
      road(2, 3),
      field([5, 6], [0.14, 0.86]),
      field([0, 1, 2, 3, 4, 7], [0.7, 0.3]),
    ],
  },
  W: {
    edges: "FRRR",
    count: 4,
    features: [
      road(1),
      road(2),
      road(3),
      field([7, 0, 1, 2], [0.5, 0.2]),
      field([3, 4], [0.8, 0.8]),
      field([5, 6], [0.2, 0.8]),
    ],
  },
  X: {
    edges: "RRRR",
    count: 1,
    features: [
      road(0),
      road(1),
      road(2),
      road(3),
      field([7, 0], [0.2, 0.2]),
      field([1, 2], [0.8, 0.2]),
      field([3, 4], [0.8, 0.8]),
      field([5, 6], [0.2, 0.8]),
    ],
  },
};

export class GameError extends Error {}

export function edgeAt(type, rot, side) {
  return TILES[type].edges[(side - rot + 4) % 4];
}

export function sidesOf(type, rot, fi) {
  return TILES[type].features[fi].sides.map((s) => (s + rot) % 4);
}

function featureOnSide(type, rot, side) {
  const local = (side - rot + 4) % 4;
  return TILES[type].features.findIndex((f) => f.sides.includes(local));
}

function featureOnPort(type, rot, port) {
  const local = (port - 2 * rot + 8) % 8;
  return TILES[type].features.findIndex((f) => f.ports?.includes(local));
}

// Position (0..1, screen oriented) where a meeple for feature fi is drawn.
export function featurePos(type, rot, fi) {
  const f = TILES[type].features[fi];
  const sides = sidesOf(type, rot, fi);
  if (f.type === "field") {
    let [x, y] = f.pos;
    for (let i = 0; i < rot; i++) [x, y] = [1 - y, x];
    return [x, y];
  }
  if (f.type === "monastery") return [0.5, 0.5];
  if (f.type === "city") {
    let sx = 0,
      sy = 0;
    for (const s of sides) {
      sx += DIRS[s][0];
      sy += DIRS[s][1];
    }
    return [0.5 + (sx / sides.length) * 0.33, 0.5 + (sy / sides.length) * 0.33];
  }
  if (sides.length === 1) {
    const [dx, dy] = DIRS[sides[0]];
    return [0.5 + dx * 0.3, 0.5 + dy * 0.3];
  }
  const [a, b] = sides;
  if (opp(a) === b) return [0.5, 0.5];
  const mid = (s) => [0.5 + DIRS[s][0] * 0.5, 0.5 + DIRS[s][1] * 0.5];
  const [ma, mb] = [mid(a), mid(b)];
  return [
    0.25 * ma[0] + 0.25 + 0.25 * mb[0],
    0.25 * ma[1] + 0.25 + 0.25 * mb[1],
  ];
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- Board queries ----------

export function fits(board, type, x, y, rot) {
  if (board.has(key(x, y))) return false;
  let neighbours = 0;
  for (let s = 0; s < 4; s++) {
    const nb = board.get(key(x + DIRS[s][0], y + DIRS[s][1]));
    if (!nb) continue;
    neighbours++;
    if (edgeAt(type, rot, s) !== edgeAt(nb.type, nb.rot, opp(s))) return false;
  }
  return neighbours > 0;
}

function candidateCells(board) {
  const cells = new Map();
  for (const t of board.values()) {
    for (const [dx, dy] of DIRS) {
      const k = key(t.x + dx, t.y + dy);
      if (!board.has(k)) cells.set(k, [t.x + dx, t.y + dy]);
    }
  }
  return [...cells.values()];
}

export function validPlacements(board, type) {
  const out = [];
  for (const [x, y] of candidateCells(board)) {
    for (let rot = 0; rot < 4; rot++)
      if (fits(board, type, x, y, rot)) out.push({ x, y, rot });
  }
  return out;
}

function hasPlacement(board, type) {
  for (const [x, y] of candidateCells(board)) {
    for (let rot = 0; rot < 4; rot++)
      if (fits(board, type, x, y, rot)) return true;
  }
  return false;
}

// Collects the full connected feature that feature fi of tile (x,y) belongs to.
// For fields, withCities also counts adjacent completed cities (needed for scoring).
export function collectFeature(board, x, y, fi, withCities = false) {
  const start = board.get(key(x, y));
  const def = TILES[start.type].features[fi];
  if (def.type === "field") return collectField(board, x, y, fi, withCities);
  if (def.type === "monastery") {
    let n = 0;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) if (board.has(key(x + dx, y + dy))) n++;
    return {
      type: "monastery",
      parts: [{ x, y, fi }],
      tiles: n,
      shields: 0,
      open: 9 - n,
      complete: n === 9,
      meeples: start.meeples
        .filter((m) => m.fi === fi)
        .map((m) => ({ ...m, x, y })),
    };
  }
  const seen = new Set();
  const tiles = new Set();
  const parts = [];
  const meeples = [];
  let open = 0,
    shields = 0;
  const stack = [[x, y, fi]];
  while (stack.length) {
    const [cx, cy, cf] = stack.pop();
    const pk = partKey(cx, cy, cf);
    if (seen.has(pk)) continue;
    seen.add(pk);
    const t = board.get(key(cx, cy));
    tiles.add(key(cx, cy));
    parts.push({ x: cx, y: cy, fi: cf });
    if (TILES[t.type].features[cf].shield) shields++;
    for (const m of t.meeples)
      if (m.fi === cf) meeples.push({ ...m, x: cx, y: cy });
    for (const s of sidesOf(t.type, t.rot, cf)) {
      const nx = cx + DIRS[s][0],
        ny = cy + DIRS[s][1];
      const nb = board.get(key(nx, ny));
      if (!nb) {
        open++;
        continue;
      }
      stack.push([nx, ny, featureOnSide(nb.type, nb.rot, opp(s))]);
    }
  }
  return {
    type: def.type,
    parts,
    tiles: tiles.size,
    shields,
    open,
    complete: open === 0,
    meeples,
  };
}

export function featurePoints(f) {
  if (f.type === "field") return 3 * (f.cities ?? 0);
  if (f.type === "city")
    return f.complete ? 2 * (f.tiles + f.shields) : f.tiles + f.shields;
  return f.tiles;
}

function collectField(board, x, y, fi, withCities) {
  const seen = new Set();
  const tiles = new Set();
  const parts = [];
  const meeples = [];
  const cityRefs = [];
  let open = 0;
  const stack = [[x, y, fi]];
  while (stack.length) {
    const [cx, cy, cf] = stack.pop();
    const pk = partKey(cx, cy, cf);
    if (seen.has(pk)) continue;
    seen.add(pk);
    const t = board.get(key(cx, cy));
    const def = TILES[t.type].features[cf];
    tiles.add(key(cx, cy));
    parts.push({ x: cx, y: cy, fi: cf });
    for (const ci of def.cities) cityRefs.push([cx, cy, ci]);
    for (const m of t.meeples)
      if (m.fi === cf) meeples.push({ ...m, x: cx, y: cy });
    for (const lp of def.ports) {
      const p = (lp + 2 * t.rot) % 8;
      const s = p >> 1;
      const nx = cx + DIRS[s][0],
        ny = cy + DIRS[s][1];
      const nb = board.get(key(nx, ny));
      if (!nb) {
        open++;
        continue;
      }
      stack.push([nx, ny, featureOnPort(nb.type, nb.rot, OPP_PORT[p])]);
    }
  }
  let cities = 0;
  let adjacentCities = 0;
  if (withCities) {
    const seenCity = new Set();
    for (const [cx, cy, ci] of cityRefs) {
      if (seenCity.has(partKey(cx, cy, ci))) continue;
      const c = collectFeature(board, cx, cy, ci);
      for (const p of c.parts) seenCity.add(partKey(p.x, p.y, p.fi));
      adjacentCities++;
      if (c.complete) cities++;
    }
  }
  return {
    type: "field",
    parts,
    tiles: tiles.size,
    shields: 0,
    open,
    complete: false,
    meeples,
    cities,
    adjacentCities,
  };
}

export function majority(meeples) {
  const counts = {};
  for (const m of meeples) counts[m.player] = (counts[m.player] || 0) + 1;
  const max = Math.max(0, ...Object.values(counts));
  return Object.keys(counts).filter((id) => counts[id] === max);
}

// Features on tile (x,y) that are unoccupied (candidates for a meeple).
export function freeFeatures(board, x, y) {
  const t = board.get(key(x, y));
  return TILES[t.type].features
    .map((_, fi) => fi)
    .filter((fi) => collectFeature(board, x, y, fi).meeples.length === 0);
}

// Occupied features that are completed by the tile at (x,y).
export function completions(board, x, y) {
  const res = [];
  const seen = new Set();
  const t = board.get(key(x, y));
  TILES[t.type].features.forEach((f, fi) => {
    if (f.type === "monastery" || f.type === "field") return;
    if (seen.has(partKey(x, y, fi))) return;
    const feat = collectFeature(board, x, y, fi);
    for (const p of feat.parts) seen.add(partKey(p.x, p.y, p.fi));
    if (feat.complete && feat.meeples.length) res.push(feat);
  });
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const nb = board.get(key(x + dx, y + dy));
      if (!nb) continue;
      TILES[nb.type].features.forEach((f, fi) => {
        if (f.type !== "monastery" || !nb.meeples.some((m) => m.fi === fi))
          return;
        const feat = collectFeature(board, nb.x, nb.y, fi);
        if (feat.complete) res.push(feat);
      });
    }
  }
  return res;
}

// ---------- Game state ----------

export function createGame(players, rng = Math.random) {
  const deck = [];
  for (const [type, def] of Object.entries(TILES)) {
    const n = def.count - (type === START_TILE ? 1 : 0);
    for (let i = 0; i < n; i++) deck.push(type);
  }
  shuffle(deck, rng);
  const board = new Map();
  board.set(key(0, 0), { x: 0, y: 0, type: START_TILE, rot: 0, meeples: [] });
  const g = {
    board,
    deck,
    players: players.map((p) => ({
      id: p.id,
      score: 0,
      meeples: MEEPLES_PER_PLAYER,
    })),
    turn: 0,
    phase: "place",
    current: null,
    lastPlaced: { x: 0, y: 0 },
    finished: false,
    events: [],
    eventSeq: 0,
  };
  drawNext(g);
  return g;
}

export const currentPlayer = (g) => g.players[g.turn];

function pushEvent(g, ev) {
  ev.id = ++g.eventSeq;
  g.events.push(ev);
  if (g.events.length > 200) g.events.shift();
}

function drawNext(g) {
  while (g.deck.length) {
    const t = g.deck.pop();
    if (hasPlacement(g.board, t)) {
      g.current = t;
      g.phase = "place";
      return;
    }
    pushEvent(g, { kind: "discard", tile: t });
  }
  g.current = null;
  finishGame(g);
}

function scoreFeature(g, f, final) {
  const pts = featurePoints(f);
  const winners = majority(f.meeples);
  for (const id of winners) g.players.find((p) => p.id === id).score += pts;
  for (const m of f.meeples) {
    const t = g.board.get(key(m.x, m.y));
    t.meeples = t.meeples.filter((mm) => mm.fi !== m.fi);
    g.players.find((p) => p.id === m.player).meeples++;
  }
  const at = f.parts[0];
  pushEvent(g, {
    kind: "score",
    feature: f.type,
    points: pts,
    players: winners,
    complete: f.complete,
    final,
    at,
  });
}

function finishGame(g) {
  const seen = new Set();
  for (const t of g.board.values()) {
    for (const m of [...t.meeples]) {
      if (seen.has(partKey(t.x, t.y, m.fi))) continue;
      const f = collectFeature(g.board, t.x, t.y, m.fi, true);
      for (const p of f.parts) seen.add(partKey(p.x, p.y, p.fi));
      if (f.meeples.length) scoreFeature(g, f, true);
    }
  }
  g.finished = true;
  g.phase = "finished";
  pushEvent(g, { kind: "end" });
}

function assertTurn(g, playerId, phase) {
  if (g.finished) throw new GameError("Het spel is afgelopen");
  if (currentPlayer(g).id !== playerId)
    throw new GameError("Je bent niet aan de beurt");
  if (g.phase !== phase) throw new GameError("Dat kan nu niet");
}

export function placeTile(g, playerId, x, y, rot) {
  assertTurn(g, playerId, "place");
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    ![0, 1, 2, 3].includes(rot)
  )
    throw new GameError("Ongeldige zet");
  if (!fits(g.board, g.current, x, y, rot))
    throw new GameError("De tegel past hier niet");
  g.board.set(key(x, y), { x, y, type: g.current, rot, meeples: [] });
  g.prevLastPlaced = g.lastPlaced;
  g.lastPlaced = { x, y };
  g.phase = "meeple";
  pushEvent(g, { kind: "place", player: playerId, tile: g.current, x, y, rot });
}

// Takes the just-placed tile back (only before the meeple decision).
export function undoPlace(g, playerId) {
  assertTurn(g, playerId, "meeple");
  g.board.delete(key(g.lastPlaced.x, g.lastPlaced.y));
  g.lastPlaced = g.prevLastPlaced;
  g.phase = "place";
  if (g.events.at(-1)?.kind === "place") g.events.pop();
}

export function meepleOptions(g) {
  if (g.phase !== "meeple" || currentPlayer(g).meeples <= 0) return [];
  return freeFeatures(g.board, g.lastPlaced.x, g.lastPlaced.y);
}

export function placeMeeple(g, playerId, fi) {
  assertTurn(g, playerId, "meeple");
  const { x, y } = g.lastPlaced;
  if (fi !== null) {
    if (!meepleOptions(g).includes(fi))
      throw new GameError("Daar kan geen pion staan");
    g.board.get(key(x, y)).meeples.push({ fi, player: playerId });
    currentPlayer(g).meeples--;
  }
  for (const f of completions(g.board, x, y)) scoreFeature(g, f, false);
  g.turn = (g.turn + 1) % g.players.length;
  drawNext(g);
}

export function serializeGame(g) {
  return {
    board: [...g.board.values()],
    current: g.current,
    deckCount: g.deck.length,
    turn: g.turn,
    phase: g.phase,
    lastPlaced: g.lastPlaced,
    finished: g.finished,
    players: g.players,
    events: g.events.slice(-40),
    placements:
      g.phase === "place" && g.current
        ? validPlacements(g.board, g.current)
        : [],
    meepleOptions: meepleOptions(g),
  };
}
