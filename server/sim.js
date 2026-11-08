// Headless bot-only games to sanity-check the rules: `npm run sim -- 20`
import {
  TILES,
  createGame,
  placeTile,
  placeMeeple,
  meepleOptions,
  currentPlayer,
  MEEPLES_PER_PLAYER,
} from "../shared/game.js";
import { chooseMove } from "./bot.js";

for (const [type, def] of Object.entries(TILES)) {
  const ports = def.features.flatMap((f) => f.ports ?? []).sort();
  const expected = [0, 1, 2, 3, 4, 5, 6, 7].filter(
    (p) => def.edges[p >> 1] !== "C",
  );
  if (ports.join() !== expected.join())
    throw new Error(`Tegel ${type}: veldpoorten ${ports} != ${expected}`);
}

const games = Number(process.argv[2]) || 10;
const levels = ["normal", "easy", "normal", "easy"];
const wins = {};
let totalTurns = 0;
let fieldPoints = 0;
const started = Date.now();

for (let n = 0; n < games; n++) {
  const players = levels.map((lvl, i) => ({ id: `${lvl}${i}` }));
  const g = createGame(players);
  let turns = 0;
  while (!g.finished) {
    const p = currentPlayer(g);
    const mv = chooseMove(g, levels[g.turn]);
    placeTile(g, p.id, mv.x, mv.y, mv.rot);
    placeMeeple(
      g,
      p.id,
      mv.fi !== null && meepleOptions(g).includes(mv.fi) ? mv.fi : null,
    );
    turns++;
  }
  totalTurns += turns;
  for (const e of g.events)
    if (e.kind === "score" && e.feature === "field") fieldPoints += e.points;

  const onBoard = [...g.board.values()].reduce(
    (s, t) => s + t.meeples.length,
    0,
  );
  const bad = g.players.filter((p) => p.meeples !== MEEPLES_PER_PLAYER);
  const discards = g.events.filter((e) => e.kind === "discard").length;
  if (onBoard || bad.length)
    throw new Error(`Meeple-telling klopt niet in spel ${n}`);
  if (g.board.size + discards !== 72)
    throw new Error(
      `Tegeltelling klopt niet in spel ${n}: ${g.board.size}+${discards}`,
    );

  const best = Math.max(...g.players.map((p) => p.score));
  for (const p of g.players)
    if (p.score === best) wins[p.id] = (wins[p.id] || 0) + 1;
  console.log(
    `Spel ${n + 1}: ${g.players.map((p) => `${p.id}=${p.score}`).join("  ")}`,
  );
}

console.log(
  `\n${games} spellen, gem. ${(totalTurns / games).toFixed(1)} beurten, ${((Date.now() - started) / games) | 0} ms/spel`,
);
console.log("Overwinningen:", wins);
console.log(`Gem. boerenpunten per spel: ${(fieldPoints / games).toFixed(1)}`);
