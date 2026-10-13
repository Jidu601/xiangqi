export const NAMES = {
  r: ["帥", "仕", "相", "馬", "車", "炮", "兵"],
  b: ["將", "士", "象", "馬", "車", "砲", "卒"],
};
export const TYPES = ["k", "a", "e", "h", "r", "c", "p"];
export const SKILL_RULES = { start: 5, cap: 10, regen: 3 };
export const SKILLS = [
  {
    id: "horse",
    name: "天马行空",
    cost: 2,
    cooldown: 1,
    mark: "瞬",
    desc: "马瞬移到全盘任意空位，无视马腿与距离，不能直接吃子。",
  },
  {
    id: "elephant",
    name: "横扫千军",
    cost: 3,
    cooldown: 1,
    mark: "扫",
    desc: "车按正常路线移动，并清除落点周围八格的敌子，将帅免疫。",
  },
  {
    id: "dash",
    name: "火炮轰天",
    cost: 4,
    cooldown: 2,
    mark: "轰",
    desc: "炮不移动，全盘锁定任意敌子，轰炸目标及周围八格！双方棋子都会受伤，将帅免疫。",
  },
  {
    id: "retreat",
    name: "偷天换日",
    cost: 6,
    cooldown: 2,
    mark: "变",
    desc: "直接策反一枚敌方车、马、炮或兵，原地变成你的棋子！",
  },
  {
    id: "swap",
    name: "乾坤挪移",
    cost: 4,
    cooldown: 1,
    mark: "换",
    desc: "一枚己方非将帅与全盘任意非将帅交换位置，可交换敌子！士象仍须落在合法区域。",
  },
  {
    id: "revive",
    name: "起死回生",
    cost: 5,
    cooldown: 2,
    mark: "生",
    desc: "复活己方被吃的任意非将帅棋子，放到己方半场的空位；士象仍须落在合法区域。",
  },
];
const other = (c) => (c === "r" ? "b" : "r"),
  xy = (i) => [i % 9, Math.floor(i / 9)],
  idx = (x, y) => y * 9 + x,
  inside = (x, y) => x >= 0 && x < 9 && y >= 0 && y < 10;
export function initial(
  mode = "classic",
  loadout = ["horse", "dash", "retreat"],
) {
  const b = Array(90).fill(null),
    back = ["r", "h", "e", "a", "k", "a", "e", "h", "r"];
  for (let x = 0; x < 9; x++) {
    b[x] = { c: "b", t: back[x] };
    b[81 + x] = { c: "r", t: back[x] };
  }
  for (const c of ["r", "b"]) {
    let y = c === "r" ? 7 : 2;
    b[idx(1, y)] = { c, t: "c" };
    b[idx(7, y)] = { c, t: "c" };
    y = c === "r" ? 6 : 3;
    for (let x = 0; x < 9; x += 2) b[idx(x, y)] = { c, t: "p" };
  }
  const s = {
    board: b,
    turn: "r",
    mode,
    energy: { r: SKILL_RULES.start, b: SKILL_RULES.start },
    cool: { r: {}, b: {} },
    used: { r: {}, b: {} },
    loadout: { r: [...loadout], b: [...loadout] },
    lost: { r: 0, b: 0 },
    grave: { r: [], b: [] },
    ply: 0,
    quiet: 0,
    records: [],
    last: null,
  };
  s.records = [{ key: key(s), turn: "r", check: false }];
  return s;
}
export const pieceName = (p) => NAMES[p.c][TYPES.indexOf(p.t)];
export function region(p, i) {
  const [x, y] = xy(i),
    r = p.c === "r" ? 9 - y : y;
  if (p.t === "k") return x >= 3 && x <= 5 && r <= 2;
  if (p.t === "a")
    return [
      [3, 0],
      [5, 0],
      [4, 1],
      [3, 2],
      [5, 2],
    ].some(([a, b]) => x === a && r === b);
  if (p.t === "e")
    return [
      [2, 0],
      [6, 0],
      [0, 2],
      [4, 2],
      [8, 2],
      [2, 4],
      [6, 4],
    ].some(([a, b]) => x === a && r === b);
  return true;
}
function raw(b, i, skill = null) {
  const p = b[i];
  if (!p) return [];
  const [x, y] = xy(i),
    out = [],
    push = (tx, ty) => {
      if (inside(tx, ty)) {
        let j = idx(tx, ty);
        if (!b[j] || b[j].c !== p.c) out.push(j);
      }
    };
  if (p.t === "r" || p.t === "c") {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      let hit = false;
      for (let tx = x + dx, ty = y + dy; inside(tx, ty); tx += dx, ty += dy) {
        let j = idx(tx, ty);
        if (p.t === "r") {
          if (b[j]) {
            if (b[j].c !== p.c) out.push(j);
            break;
          }
          out.push(j);
        } else if (!hit) {
          if (b[j]) hit = true;
          else out.push(j);
        } else if (b[j]) {
          if (b[j].c !== p.c) out.push(j);
          break;
        }
      }
    }
  }
  if (p.t === "h")
    for (const [dx, dy] of [
      [1, 2],
      [-1, 2],
      [1, -2],
      [-1, -2],
      [2, 1],
      [2, -1],
      [-2, 1],
      [-2, -1],
    ]) {
      const leg = idx(
        x + (Math.abs(dx) === 2 ? Math.sign(dx) : 0),
        y + (Math.abs(dy) === 2 ? Math.sign(dy) : 0),
      );
      if (skill === "horse" || !b[leg]) push(x + dx, y + dy);
    }
  if (p.t === "e")
    for (const dx of [-2, 2])
      for (const dy of [-2, 2]) {
        const j = idx(x + dx, y + dy);
        if (
          inside(x + dx, y + dy) &&
          region(p, j) &&
          (skill === "elephant" || !b[idx(x + dx / 2, y + dy / 2)])
        )
          push(x + dx, y + dy);
      }
  if (p.t === "a")
    for (const dx of [-1, 1])
      for (const dy of [-1, 1])
        if (inside(x + dx, y + dy) && region(p, idx(x + dx, y + dy)))
          push(x + dx, y + dy);
  if (p.t === "k") {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      if (inside(x + dx, y + dy) && region(p, idx(x + dx, y + dy)))
        push(x + dx, y + dy);
    for (const dy of [-1, 1])
      for (let ty = y + dy; inside(x, ty); ty += dy) {
        const q = b[idx(x, ty)];
        if (q) {
          if (q.c !== p.c && q.t === "k") out.push(idx(x, ty));
          break;
        }
      }
  }
  if (p.t === "p") {
    const d = p.c === "r" ? -1 : 1,
      cross = p.c === "r" ? y <= 4 : y >= 5;
    if (skill === "dash") {
      if (inside(x, y + 2 * d) && !b[idx(x, y + d)] && !b[idx(x, y + 2 * d)])
        out.push(idx(x, y + 2 * d));
    } else if (skill === "retreat") {
      if (cross && inside(x, y - d) && !b[idx(x, y - d)])
        out.push(idx(x, y - d));
    } else {
      push(x, y + d);
      if (cross) {
        push(x - 1, y);
        push(x + 1, y);
      }
    }
  }
  return out;
}
export function inCheck(s, c = s.turn) {
  let k = s.board.findIndex((p) => p?.c === c && p.t === "k");
  if (k < 0) return true;
  return s.board.some((p, i) => p && p.c !== c && raw(s.board, i).includes(k));
}
function allowed(s, id) {
  const a = SKILLS.find((x) => x.id === id),
    c = s.turn;
  return (
    s.mode === "skills" &&
    s.loadout[c].includes(id) &&
    s.energy[c] >= a.cost &&
    !s.cool[c][id] &&
    !(a.once && s.used[c][id])
  );
}
export function area(center) {
  const [x, y] = xy(center),
    out = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if (inside(x + dx, y + dy)) out.push(idx(x + dx, y + dy));
  return out;
}
export function casualties(s, a) {
  if (a.skill === "dash")
    return area(a.to).filter((j) => s.board[j] && s.board[j].t !== "k");
  if (a.skill === "elephant")
    return area(a.to).filter(
      (j) => s.board[j] && s.board[j].c !== s.turn && s.board[j].t !== "k",
    );
  if (!a.skill || a.skill === "horse") return s.board[a.to] ? [a.to] : [];
  return [];
}
export function actions(s) {
  const moves = [],
    c = s.turn,
    b = s.board;
  const available = Object.fromEntries(
    SKILLS.map((t) => [t.id, allowed(s, t.id)]),
  );
  for (let i = 0; i < 90; i++) {
    const p = b[i];
    if (!p || p.c !== c) continue;
    const normal = raw(b, i);
    for (const j of normal) if (b[j]?.t !== "k") moves.push({ from: i, to: j });
    if (available.horse && p.t === "h")
      for (let j = 0; j < 90; j++)
        if (!b[j] && !normal.includes(j))
          moves.push({ from: i, to: j, skill: "horse" });
    if (available.elephant && p.t === "r")
      for (const j of normal)
        if (
          b[j]?.t !== "k" &&
          casualties(s, { from: i, to: j, skill: "elephant" }).length
        )
          moves.push({ from: i, to: j, skill: "elephant" });
    if (available.dash && p.t === "c")
      for (let j = 0; j < 90; j++)
        if (b[j] && b[j].c !== c && b[j].t !== "k")
          moves.push({ from: i, to: j, skill: "dash" });
    if (available.swap && p.t !== "k")
      for (let j = 0; j < 90; j++)
        if (
          j !== i &&
          b[j] &&
          b[j].t !== "k" &&
          (b[j].c !== c || j > i) &&
          !(b[j].c === c && b[j].t === p.t) &&
          region(p, j) &&
          region(b[j], i)
        )
          moves.push({ from: i, to: j, skill: "swap" });
  }
  if (available.retreat)
    for (let j = 0; j < 90; j++)
      if (b[j] && b[j].c !== c && ["r", "h", "c", "p"].includes(b[j].t))
        moves.push({ from: -1, to: j, skill: "retreat" });
  if (available.revive)
    for (const t of [...new Set(s.grave?.[c] || [])].sort(
      (a, b) =>
        ["r", "c", "h", "e", "a", "p"].indexOf(a) -
        ["r", "c", "h", "e", "a", "p"].indexOf(b),
    ))
      for (let j = 0; j < 90; j++) {
        const [, y] = xy(j);
        if (!b[j] && (c === "r" ? y >= 5 : y <= 4) && region({ c, t }, j))
          moves.push({ from: -1, to: j, skill: "revive", pieceType: t });
      }
  return moves.filter((a) => !inCheck(advance(s, a, false), c));
}
export function key(s) {
  return (
    s.board.map((p) => (p ? p.c + p.t : "_")).join("") +
    s.turn +
    (s.mode === "skills"
      ? JSON.stringify([
          s.energy,
          s.cool,
          s.used,
          s.lost,
          {
            r: [...(s.grave?.r || [])].sort(),
            b: [...(s.grave?.b || [])].sort(),
          },
        ])
      : "")
  );
}
export function advance(s, a, record = true) {
  const n = {
    ...s,
    board: s.board.slice(),
    energy: { ...s.energy },
    cool: { r: { ...s.cool.r }, b: { ...s.cool.b } },
    used: { r: { ...s.used.r }, b: { ...s.used.b } },
    lost: { ...s.lost },
    grave: { r: [...(s.grave?.r || [])], b: [...(s.grave?.b || [])] },
    last: a,
  };
  const c = s.turn,
    p = s.board[a.from],
    q = s.board[a.to];
  const victims = casualties(s, a);
  for (const j of victims) {
    const v = s.board[j];
    n.grave[v.c].push(v.t);
    if (v.t === "p") n.lost[v.c]++;
    n.board[j] = null;
  }
  if (a.skill === "swap") {
    n.board[a.from] = q;
    n.board[a.to] = p;
  } else if (a.skill === "retreat") {
    n.board[a.to] = { ...q, c };
  } else if (a.skill === "revive") {
    n.board[a.to] = { c, t: a.pieceType };
    n.grave[c].splice(n.grave[c].indexOf(a.pieceType), 1);
    if (a.pieceType === "p") n.lost[c]--;
  } else if (a.skill !== "dash") {
    n.board[a.from] = null;
    n.board[a.to] = p;
  }
  if (a.skill) {
    const t = SKILLS.find((x) => x.id === a.skill);
    n.energy[c] -= t.cost;
    if (t.once) n.used[c][a.skill] = true;
    else n.cool[c][a.skill] = t.cooldown + 1;
  }
  n.turn = other(c);
  n.ply = s.ply + 1;
  n.quiet =
    victims.length ||
    p?.t === "p" ||
    a.skill === "revive" ||
    a.skill === "retreat"
      ? 0
      : s.quiet + 1;
  for (const id of Object.keys(n.cool[n.turn])) {
    n.cool[n.turn][id] = Math.max(0, n.cool[n.turn][id] - 1);
    if (!n.cool[n.turn][id]) delete n.cool[n.turn][id];
  }
  // Both players start equally; regeneration begins on their later turns.
  if (n.mode === "skills" && n.ply > 1)
    n.energy[n.turn] = Math.min(
      SKILL_RULES.cap,
      n.energy[n.turn] + SKILL_RULES.regen,
    );
  if (record)
    n.records = [
      ...s.records,
      { key: key(n), turn: n.turn, check: inCheck(n) },
    ];
  return n;
}
export function outcome(s, legal) {
  if (!s.board.some((p) => p?.c === s.turn && p.t === "k"))
    return { winner: other(s.turn), reason: "将帅缺失" };
  if (!(legal || actions(s)).length)
    return { winner: other(s.turn), reason: inCheck(s) ? "将死" : "困毙" };
  const k = key(s),
    hits = s.records
      .map((r, i) => (r.key === k ? i : -1))
      .filter((i) => i >= 0);
  if (hits.length >= 3) {
    const cycle = s.records.slice(hits.at(-3) + 1);
    const perpetual = ["r", "b"].filter((c) => {
      const turns = cycle.filter((r) => r.turn === other(c));
      return turns.length && turns.every((r) => r.check);
    });
    if (perpetual.length === 1)
      return { winner: other(perpetual[0]), reason: "长将判负" };
    return { winner: null, reason: "三次重复局面和棋" };
  }
  if (s.quiet >= 120)
    return { winner: null, reason: "连续 60 回合未吃子或走兵，和棋" };
  return null;
}
export function notation(s, a) {
  const coord = (i) => "ABCDEFGHI"[i % 9] + (10 - Math.floor(i / 9)),
    label = a.skill ? SKILLS.find((t) => t.id === a.skill).name + " · " : "";
  if (a.skill === "retreat")
    return label + "策反" + pieceName(s.board[a.to]) + " " + coord(a.to);
  if (a.skill === "revive")
    return (
      label +
      "复活" +
      pieceName({ c: s.turn, t: a.pieceType }) +
      " → " +
      coord(a.to)
    );
  const hits = casualties(s, a),
    friendly = hits.filter((j) => s.board[j].c === s.turn).length;
  return (
    label +
    pieceName(s.board[a.from]) +
    " " +
    coord(a.from) +
    (a.skill === "dash" ? " 轰击 " : " → ") +
    coord(a.to) +
    (hits.length
      ? " · 清除 " +
        hits.length +
        " 子" +
        (friendly ? "（含己方 " + friendly + "）" : "")
      : "")
  );
}
