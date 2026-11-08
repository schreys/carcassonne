import {
  TILES,
  key,
  validPlacements,
  collectFeature,
  completions,
  featurePoints,
  majority,
  freeFeatures,
} from "../shared/game.js";

const pk = (x, y, fi) => `${x},${y},${fi}`;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const BOT_LEVELS = ["easy", "normal"];

// Returns { x, y, rot, fi } where fi is the meeple feature index or null.
export function chooseMove(g, level = "normal") {
  const me = g.players[g.turn];
  const placements = validPlacements(g.board, g.current);

  if (level === "easy") {
    const p = pick(placements);
    const tile = { x: p.x, y: p.y, type: g.current, rot: p.rot, meeples: [] };
    g.board.set(key(p.x, p.y), tile);
    const opts = me.meeples > 0 ? freeFeatures(g.board, p.x, p.y) : [];
    g.board.delete(key(p.x, p.y));
    return { ...p, fi: opts.length && Math.random() < 0.4 ? pick(opts) : null };
  }

  let best = null;
  let bestVal = -Infinity;
  for (const p of placements) {
    const tile = { x: p.x, y: p.y, type: g.current, rot: p.rot, meeples: [] };
    g.board.set(key(p.x, p.y), tile);
    const opts = me.meeples > 0 ? freeFeatures(g.board, p.x, p.y) : [];
    for (const fi of [null, ...opts]) {
      if (fi !== null) tile.meeples.push({ fi, player: me.id });
      const v = evaluate(g, me, p.x, p.y, fi) + Math.random() * 0.3;
      if (fi !== null) tile.meeples.pop();
      if (v > bestVal) {
        bestVal = v;
        best = { ...p, fi };
      }
    }
    g.board.delete(key(p.x, p.y));
  }
  return best;
}

function expected(f, deckFactor) {
  if (f.type === "city") {
    const base = f.tiles + f.shields;
    return base * (1 + deckFactor / (1 + 0.6 * f.open));
  }
  if (f.type === "road") return f.tiles + 0.5 * deckFactor;
  if (f.type === "field")
    return 3 * f.cities + 1.2 * (f.adjacentCities - f.cities) * deckFactor;
  return f.tiles + (9 - f.tiles) * 0.7 * deckFactor;
}

// Heuristic: my (expected) points minus a share of opponents' points for features touching this tile.
function evaluate(g, me, x, y, placedFi) {
  const deckFactor = Math.min(1, g.deck.length / 40);
  const seen = new Set();
  let v = 0;
  const consider = (f) => {
    if (!f.meeples.length) return;
    const pts = f.complete ? featurePoints(f) : expected(f, deckFactor);
    for (const id of majority(f.meeples)) v += id === me.id ? pts : -pts * 0.5;
    if (f.complete)
      v +=
        f.meeples.filter((m) => m.player === me.id).length * 1.5 * deckFactor;
  };

  for (const f of completions(g.board, x, y)) {
    for (const p of f.parts) seen.add(pk(p.x, p.y, p.fi));
    consider(f);
  }
  const t = g.board.get(key(x, y));
  TILES[t.type].features.forEach((def, fi) => {
    if (seen.has(pk(x, y, fi))) return;
    const f = collectFeature(g.board, x, y, fi, true);
    for (const p of f.parts) seen.add(pk(p.x, p.y, p.fi));
    if (!f.complete) consider(f);
  });
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const nb = g.board.get(key(x + dx, y + dy));
      if (!nb) continue;
      TILES[nb.type].features.forEach((def, fi) => {
        if (def.type !== "monastery" || seen.has(pk(nb.x, nb.y, fi))) return;
        const f = collectFeature(g.board, nb.x, nb.y, fi);
        if (!f.complete) consider(f);
      });
    }
  }
  if (placedFi !== null) {
    v -= (1 + (me.meeples <= 2 ? 2.5 : 0)) * deckFactor + 0.2;
    // Farmers never come back.
    if (TILES[t.type].features[placedFi].type === "field") v -= 2 * deckFactor;
  }
  return v;
}
