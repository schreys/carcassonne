import { TILES, DIRS, featurePos, edgeAt, opp } from "/shared/game.js";

export const THEMES = {
  classic: {
    label: "Klassiek",
    emoji: "🏰",
    subtitle: "Bouw steden, wegen en kloosters in Zuid-Frankrijk",
    names: {
      city: "stad",
      road: "weg",
      monastery: "klooster",
      field: "weiland",
      meeple: "volgeling",
      meeples: "volgelingen",
    },
    ui: {
      bg: "#24321f",
      panel: "rgba(250,244,228,0.95)",
      text: "#2b2116",
      accent: "#a0522d",
      font: "Georgia, 'Times New Roman', serif",
      titleFont: "'Cinzel', Georgia, serif",
    },
    field: "#8dbb5a",
    fieldDots: "#79a64a",
    city: "#d2a66a",
    cityEdge: "#7a5530",
    cityPattern: "stones",
    road: "#f1e7cf",
    roadEdge: "#8f7d5b",
    roadLine: null,
    junction: "#8f7d5b",
    monastery: "⛪",
    shield: "🛡️",
    decorations: ["🌳", "🌼", "🐑", "🌲"],
    meeple: "classic",
  },
  horror: {
    label: "Horror",
    emoji: "🎃",
    subtitle: "Durf jij het spookland te bouwen?",
    names: {
      city: "spookkasteel",
      road: "kerkhofpad",
      monastery: "crypte",
      field: "moeras",
      meeple: "spook",
      meeples: "spoken",
    },
    ui: {
      bg: "#0d0a12",
      panel: "rgba(28,20,34,0.94)",
      text: "#eadff0",
      accent: "#b3122e",
      font: "'Trebuchet MS', sans-serif",
      titleFont: "'Creepster', cursive",
    },
    field: "#3a4636",
    fieldDots: "#2b3529",
    city: "#4b3460",
    cityEdge: "#140a1c",
    cityPattern: "windows",
    road: "#6b5845",
    roadEdge: "#2a1d12",
    roadLine: "#8a1022",
    junction: "#8a1022",
    monastery: "🪦",
    shield: "💀",
    decorations: ["🎃", "🦇", "🕸️", "🕯️", "🍄"],
    meeple: "ghost",
  },
  xmas: {
    label: "Kerst",
    emoji: "🎄",
    subtitle: "Ho ho ho! Bouw het gezelligste winterdorp",
    names: {
      city: "peperkoekdorp",
      road: "sleepad",
      monastery: "kerstboom",
      field: "sneeuwveld",
      meeple: "elf",
      meeples: "elfen",
    },
    ui: {
      bg: "#0b2342",
      panel: "rgba(255,253,248,0.95)",
      text: "#3a1a12",
      accent: "#c0392b",
      font: "'Trebuchet MS', sans-serif",
      titleFont: "'Mountains of Christmas', cursive",
    },
    field: "#f4f9fc",
    fieldDots: "#d7e8f3",
    city: "#b5713a",
    cityEdge: "#ffffff",
    cityPattern: "icing",
    road: "#bfe0f2",
    roadEdge: "#7fb3d1",
    roadLine: "#ffffff",
    junction: "#c0392b",
    monastery: "🎄",
    shield: "🎁",
    decorations: ["⛄", "🎁", "🦌", "🍪", "🔔"],
    meeple: "santa",
  },
  game: {
    label: "Spelletjes",
    emoji: "🍄",
    subtitle: "Spring, verzamel muntjes en bouw je level!",
    names: {
      city: "blokkenkasteel",
      road: "levelpad",
      monastery: "bonusblok",
      field: "grasveld",
      meeple: "held",
      meeples: "helden",
    },
    ui: {
      bg: "#5c94fc",
      panel: "rgba(255,255,255,0.95)",
      text: "#1b1b1b",
      accent: "#e52521",
      font: "'Trebuchet MS', sans-serif",
      titleFont: "'Press Start 2P', monospace",
    },
    field: "#5ccf4a",
    fieldDots: "#45b236",
    city: "#c8662a",
    cityEdge: "#3a1804",
    cityPattern: "bricks",
    road: "#f4c47a",
    roadEdge: "#9b6a2c",
    roadLine: null,
    junction: "#1fa34a",
    monastery: "qblock",
    shield: "🪙",
    decorations: ["🍄", "⭐", "🪙", "🌸", "🐢"],
    meeple: "pixel",
  },
};

const EMOJI_FONT =
  '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
export const TILE_PX = 192;
const cache = new Map();
export const clearTileCache = () => cache.clear();

export function tileImage(themeId, type, rot, variant = 0) {
  const k = `${themeId}|${type}|${rot}|${variant}`;
  let c = cache.get(k);
  if (!c) {
    c = document.createElement("canvas");
    c.width = c.height = TILE_PX;
    paintTile(c.getContext("2d"), THEMES[themeId], type, rot, variant);
    cache.set(k, c);
  }
  return c;
}

function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function drawEmoji(ctx, ch, x, y, size) {
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ch, x, y);
}

// Shapes in unit coords for the canonical orientation, rotated q quarter turns clockwise.
function shapePath(ctx, S, q, cmds) {
  const P = (x, y) => {
    for (let i = 0; i < q; i++) [x, y] = [1 - y, x];
    return [x * S, y * S];
  };
  for (const [c, ...pts] of cmds) {
    const args = [];
    for (let i = 0; i < pts.length; i += 2) args.push(...P(pts[i], pts[i + 1]));
    ctx[c](...args);
  }
}

function cityShape(sides) {
  const n = sides.length;
  if (n === 4)
    return {
      q: 0,
      fill: [
        ["moveTo", 0, 0],
        ["lineTo", 1, 0],
        ["lineTo", 1, 1],
        ["lineTo", 0, 1],
      ],
      walls: [],
    };
  if (n === 3) {
    const missing = [0, 1, 2, 3].find((s) => !sides.includes(s));
    return {
      q: (missing + 2) % 4,
      fill: [
        ["moveTo", 0, 0],
        ["lineTo", 1, 0],
        ["lineTo", 1, 1],
        ["quadraticCurveTo", 0.5, 0.55, 0, 1],
      ],
      walls: [
        [
          ["moveTo", 1, 1],
          ["quadraticCurveTo", 0.5, 0.55, 0, 1],
        ],
      ],
    };
  }
  if (n === 2 && opp(sides[0]) === sides[1]) {
    return {
      q: sides.includes(1) ? 0 : 1,
      fill: [
        ["moveTo", 0, 0],
        ["quadraticCurveTo", 0.5, 0.32, 1, 0],
        ["lineTo", 1, 1],
        ["quadraticCurveTo", 0.5, 0.68, 0, 1],
      ],
      walls: [
        [
          ["moveTo", 0, 0],
          ["quadraticCurveTo", 0.5, 0.32, 1, 0],
        ],
        [
          ["moveTo", 1, 1],
          ["quadraticCurveTo", 0.5, 0.68, 0, 1],
        ],
      ],
    };
  }
  if (n === 2) {
    const a = [0, 1, 2, 3].find(
      (s) => sides.includes(s) && sides.includes((s + 3) % 4),
    );
    return {
      q: a,
      fill: [
        ["moveTo", 0, 0],
        ["lineTo", 1, 0],
        ["quadraticCurveTo", 0.58, 0.58, 0, 1],
      ],
      walls: [
        [
          ["moveTo", 1, 0],
          ["quadraticCurveTo", 0.58, 0.58, 0, 1],
        ],
      ],
    };
  }
  return {
    q: sides[0],
    fill: [
      ["moveTo", 0, 0],
      ["lineTo", 1, 0],
      ["quadraticCurveTo", 0.5, 0.55, 0, 0],
    ],
    walls: [
      [
        ["moveTo", 1, 0],
        ["quadraticCurveTo", 0.5, 0.55, 0, 0],
      ],
    ],
  };
}

function cityPattern(ctx, th, S, rnd) {
  switch (th.cityPattern) {
    case "bricks": {
      ctx.strokeStyle = "rgba(60,20,0,0.75)";
      ctx.lineWidth = S * 0.012;
      const h = S / 8;
      for (let r = 0; r < 8; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * h);
        ctx.lineTo(S, r * h);
        for (let c = (r % 2) * 0.5; c < 4; c++) {
          ctx.moveTo((c * S) / 4, r * h);
          ctx.lineTo((c * S) / 4, (r + 1) * h);
        }
        ctx.stroke();
      }
      break;
    }
    case "stones": {
      ctx.strokeStyle = "rgba(90,60,30,0.35)";
      ctx.lineWidth = S * 0.01;
      for (let i = 0; i < 26; i++) {
        const x = rnd() * S,
          y = rnd() * S;
        ctx.strokeRect(x, y, S * 0.08, S * 0.05);
      }
      ctx.fillStyle = "#b5482f";
      for (let i = 0; i < 5; i++) {
        const x = rnd() * S,
          y = rnd() * S,
          w = S * 0.07;
        ctx.beginPath();
        ctx.moveTo(x - w, y);
        ctx.lineTo(x, y - w * 0.8);
        ctx.lineTo(x + w, y);
        ctx.fill();
      }
      break;
    }
    case "windows": {
      for (let i = 0; i < 14; i++) {
        const x = rnd() * S,
          y = rnd() * S;
        ctx.fillStyle = rnd() < 0.6 ? "#f7c948" : "#1a0f22";
        ctx.fillRect(x, y, S * 0.035, S * 0.055);
      }
      break;
    }
    case "icing": {
      const colors = ["#e74c3c", "#2ecc71", "#f1c40f", "#ffffff"];
      for (let i = 0; i < 16; i++) {
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.arc(rnd() * S, rnd() * S, S * 0.018, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
}

function paintTile(ctx, th, type, rot, variant) {
  const S = TILE_PX;
  const def = TILES[type];
  const rnd = seeded(type.charCodeAt(0) * 97 + rot * 13 + variant * 7919);

  ctx.fillStyle = th.field;
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = th.fieldDots;
  for (let i = 0; i < 45; i++) {
    const x = rnd() * S,
      y = rnd() * S;
    if (th.meeple === "pixel")
      ctx.fillRect(Math.floor(x / 8) * 8, Math.floor(y / 8) * 8, 6, 6);
    else {
      ctx.beginPath();
      ctx.arc(x, y, 1.5 + rnd() * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.rotate((rot * Math.PI) / 2);
  ctx.translate(-S / 2, -S / 2);

  // Roads
  const M = [
    [0.5, 0],
    [1, 0.5],
    [0.5, 1],
    [0, 0.5],
  ];
  const roads = def.features.filter((f) => f.type === "road");
  const singles = roads.filter((f) => f.sides.length === 1).length;
  if (roads.length) {
    ctx.beginPath();
    for (const f of roads) {
      const [a, b] = f.sides;
      ctx.moveTo(M[a][0] * S, M[a][1] * S);
      if (b === undefined)
        ctx.lineTo((0.5 + DIRS[a][0] * 0.1) * S, (0.5 + DIRS[a][1] * 0.1) * S);
      else ctx.quadraticCurveTo(S / 2, S / 2, M[b][0] * S, M[b][1] * S);
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = th.roadEdge;
    ctx.lineWidth = S * 0.17;
    ctx.stroke();
    ctx.strokeStyle = th.road;
    ctx.lineWidth = S * 0.11;
    ctx.stroke();
    if (th.roadLine) {
      ctx.setLineDash([S * 0.04, S * 0.05]);
      ctx.strokeStyle = th.roadLine;
      ctx.lineWidth = S * 0.018;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (singles >= 3) {
      ctx.beginPath();
      ctx.arc(S / 2, S / 2, S * 0.11, 0, Math.PI * 2);
      ctx.fillStyle = th.junction;
      ctx.fill();
      ctx.lineWidth = S * 0.025;
      ctx.strokeStyle = th.roadEdge;
      ctx.stroke();
    }
  }

  // Cities
  for (const f of def.features) {
    if (f.type !== "city") continue;
    const shape = cityShape(f.sides);
    ctx.save();
    ctx.beginPath();
    shapePath(ctx, S, shape.q, shape.fill);
    ctx.closePath();
    ctx.fillStyle = th.city;
    ctx.fill();
    ctx.clip();
    cityPattern(ctx, th, S, rnd);
    ctx.restore();
    ctx.lineCap = "round";
    ctx.strokeStyle = th.cityEdge;
    ctx.lineWidth = S * 0.045;
    for (const w of shape.walls) {
      ctx.beginPath();
      shapePath(ctx, S, shape.q, w);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Screen-oriented icons
  def.features.forEach((f, fi) => {
    const [px, py] = featurePos(type, rot, fi);
    if (f.type === "monastery") {
      if (th.monastery === "qblock") drawQBlock(ctx, px * S, py * S, S * 0.36);
      else drawEmoji(ctx, th.monastery, px * S, py * S, S * 0.42);
    }
    if (f.shield) {
      const sx = Math.min(0.85, Math.max(0.15, px + 0.15)) * S;
      const sy = Math.min(0.85, Math.max(0.15, py - 0.15)) * S;
      drawEmoji(ctx, th.shield, sx, sy, S * 0.17);
    }
  });

  if (variant > 0) {
    const corners = [
      [0.16, 0.16, 0, 3],
      [0.84, 0.16, 0, 1],
      [0.84, 0.84, 1, 2],
      [0.16, 0.84, 2, 3],
    ].filter(
      ([, , a, b]) =>
        edgeAt(type, rot, a) !== "C" && edgeAt(type, rot, b) !== "C",
    );
    const count = variant === 3 ? 2 : 1;
    for (let i = 0; i < Math.min(count, corners.length); i++) {
      const [cx, cy] = corners[(variant + i) % corners.length];
      drawEmoji(
        ctx,
        th.decorations[Math.floor(rnd() * th.decorations.length)],
        cx * S,
        cy * S,
        S * 0.18,
      );
    }
  }

  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, S - 2, S - 2);
}

function drawQBlock(ctx, x, y, size) {
  const h = size / 2;
  ctx.fillStyle = "#7a3d00";
  ctx.fillRect(x - h + 3, y - h + 3, size, size);
  ctx.fillStyle = "#f8b800";
  ctx.fillRect(x - h, y - h, size, size);
  ctx.fillStyle = "#7a3d00";
  const r = size * 0.07;
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    ctx.fillRect(
      x + dx * (h - r * 2) - r / 2,
      y + dy * (h - r * 2) - r / 2,
      r,
      r,
    );
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${size * 0.7}px 'Press Start 2P', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("?", x + size * 0.04, y + size * 0.06);
}

// ---------- Meeples ----------

const PIXEL_MEEPLE = [
  "...XXX...",
  "..XXXXX..",
  "..XEXEX..",
  "...XXX...",
  "XXXXXXXXX",
  ".XXXXXXX.",
  "..XXXXX..",
  "..XX.XX..",
  ".XXX.XXX.",
];

function classicMeeple(ctx, x, y, u, color) {
  const pts = [
    [-1.5, -1.8],
    [1.5, -1.8],
    [4.5, -0.6],
    [4.5, 0.8],
    [2, 0.8],
    [3.5, 4.5],
    [0.8, 4.5],
    [0, 2.6],
    [-0.8, 4.5],
    [-3.5, 4.5],
    [-2, 0.8],
    [-4.5, 0.8],
    [-4.5, -0.6],
  ];
  ctx.beginPath();
  pts.forEach(([px, py], i) =>
    i ? ctx.lineTo(x + px * u, y + py * u) : ctx.moveTo(x + px * u, y + py * u),
  );
  ctx.closePath();
  ctx.moveTo(x + 1.9 * u, y - 3.3 * u);
  ctx.arc(x, y - 3.3 * u, 1.9 * u, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = u * 0.6;
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.stroke();
}

export function drawMeeple(ctx, style, x, y, size, color, lying = false) {
  const u = size / 10;
  ctx.save();
  if (lying) {
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    ctx.translate(-x, -y);
  }
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = u * 2;
  ctx.shadowOffsetY = u * 0.6;
  if (style === "ghost") {
    const w = 3.6 * u,
      top = y - 1.5 * u,
      bottom = y + 4.5 * u;
    ctx.beginPath();
    ctx.moveTo(x - w, bottom);
    ctx.lineTo(x - w, top);
    ctx.arc(x, top, w, Math.PI, 0);
    ctx.lineTo(x + w, bottom);
    for (let i = 0; i < 3; i++) {
      const x1 = x + w - (i + 0.5) * ((2 * w) / 3),
        x2 = x + w - (i + 1) * ((2 * w) / 3);
      ctx.quadraticCurveTo(x1, bottom - 1.8 * u, x2, bottom);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = u * 0.5;
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.stroke();
    ctx.fillStyle = "#000";
    for (const dx of [-1.3, 1.3]) {
      ctx.beginPath();
      ctx.ellipse(
        x + dx * u,
        top - 0.3 * u,
        0.7 * u,
        1.1 * u,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(x, top + 2 * u, 0.8 * u, 0.6 * u, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === "pixel") {
    const p = size / PIXEL_MEEPLE.length;
    const ox = x - (PIXEL_MEEPLE[0].length * p) / 2,
      oy = y - (PIXEL_MEEPLE.length * p) / 2;
    PIXEL_MEEPLE.forEach((row, r) =>
      [...row].forEach((ch, c) => {
        if (ch === ".") return;
        ctx.fillStyle = ch === "E" ? "#000" : color;
        ctx.fillRect(ox + c * p, oy + r * p, Math.ceil(p), Math.ceil(p));
      }),
    );
  } else {
    classicMeeple(ctx, x, y, u, color);
    if (style === "santa") {
      ctx.shadowColor = "transparent";
      ctx.fillStyle = "#d62828";
      ctx.beginPath();
      ctx.moveTo(x - 2 * u, y - 4.4 * u);
      ctx.lineTo(x + 2 * u, y - 4.4 * u);
      ctx.lineTo(x + 3 * u, y - 7.6 * u);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(x - 2.3 * u, y - 4.9 * u, 4.6 * u, 1.1 * u);
      ctx.beginPath();
      ctx.arc(x + 3 * u, y - 7.6 * u, 0.8 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ---------- Animated backgrounds ----------

const particles = { snow: [], fog: [], clouds: [] };

function ensure(list, n, make) {
  while (list.length < n) list.push(make());
}

export function drawBackground(ctx, themeId, w, h, t) {
  const th = THEMES[themeId];
  if (themeId === "game") {
    ctx.fillStyle = th.ui.bg;
    ctx.fillRect(0, 0, w, h);
    ensure(particles.clouds, 7, () => ({
      x: Math.random(),
      y: Math.random() * 0.6,
      s: 0.6 + Math.random() * 0.8,
      v: 0.004 + Math.random() * 0.006,
    }));
    ctx.fillStyle = "#ffffff";
    for (const c of particles.clouds) {
      const cx = (((c.x + (t / 1000) * c.v) % 1.2) - 0.1) * w,
        cy = c.y * h,
        s = 24 * c.s;
      ctx.fillRect(cx, cy, s * 4, s);
      ctx.fillRect(cx + s, cy - s * 0.8, s * 2, s);
    }
    ctx.fillStyle = "#3aa53a";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(((i + 0.3) * w) / 3.5, h + 40, 160 + (i % 2) * 70, Math.PI, 0);
      ctx.fill();
    }
    return;
  }
  const g = ctx.createRadialGradient(
    w / 2,
    h / 2,
    50,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.75,
  );
  if (themeId === "horror") {
    g.addColorStop(0, "#2a1838");
    g.addColorStop(1, "#050308");
  } else if (themeId === "xmas") {
    g.addColorStop(0, "#1d4f7a");
    g.addColorStop(1, "#071629");
  } else {
    g.addColorStop(0, "#3f5a33");
    g.addColorStop(1, "#18230f");
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (themeId === "horror") {
    ctx.fillStyle = "#f4ecc2";
    ctx.shadowColor = "#f4ecc2";
    ctx.shadowBlur = 40;
    ctx.beginPath();
    ctx.arc(
      w - Math.min(140, w * 0.14),
      Math.min(110, w * 0.2),
      Math.min(48, w * 0.07),
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }
  if (themeId === "xmas") {
    for (let i = 0; i < 60; i++) {
      const x = (i * 137.5) % w,
        y = (i * 71.3) % (h * 0.6);
      ctx.fillStyle = `rgba(255,255,230,${0.3 + 0.5 * Math.abs(Math.sin(t / 900 + i))})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }
}

export function drawForeground(ctx, themeId, w, h, t) {
  if (themeId === "xmas") {
    ensure(particles.snow, 140, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 1 + Math.random() * 2.5,
      v: 0.03 + Math.random() * 0.05,
      p: Math.random() * 6,
    }));
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (const s of particles.snow) {
      const y = ((s.y + (t / 1000) * s.v) % 1) * h;
      const x = (s.x * w + Math.sin(t / 1000 + s.p) * 20 + w) % w;
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (themeId === "horror") {
    ensure(particles.fog, 7, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 150 + Math.random() * 200,
      v: 0.004 + Math.random() * 0.006,
    }));
    for (const f of particles.fog) {
      const x = (((f.x + (t / 1000) * f.v) % 1.4) - 0.2) * w,
        y = f.y * h;
      const g = ctx.createRadialGradient(x, y, 0, x, y, f.r);
      g.addColorStop(0, "rgba(200,190,220,0.10)");
      g.addColorStop(1, "rgba(200,190,220,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - f.r, y - f.r, f.r * 2, f.r * 2);
    }
    const phase = t % 11000;
    if (phase < 90 || (phase > 180 && phase < 240)) {
      ctx.fillStyle = "rgba(230,230,255,0.22)";
      ctx.fillRect(0, 0, w, h);
    }
  }
}
