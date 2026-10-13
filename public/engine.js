export const NAMES = {
  r: ["帥", "仕", "相", "馬", "車", "炮", "兵"],
  b: ["將", "士", "象", "馬", "車", "砲", "卒"],
};
export const TYPES = ["k", "a", "e", "h", "r", "c", "p"];
export const SKILLS = [
  {
    id: "horse",
    name: "跃马",
    cost: 2,
    cooldown: 3,
    mark: "馬",
    desc: "马忽略蹩马腿，仍走日字，可吃子。",
  },
  {
    id: "elephant",
    name: "飞象",
    cost: 2,
    cooldown: 3,
    mark: "象",
    desc: "相／象忽略塞象眼，不能过河。",
  },
  {
    id: "dash",
    name: "疾行",
    cost: 2,
    cooldown: 3,
    mark: "兵",
    desc: "兵卒向前两格，路径须空，不能吃子。",
  },
  {
    id: "retreat",
    name: "回马",
    cost: 2,
    cooldown: 3,
    mark: "↶",
    desc: "过河兵卒后退一格，不能吃子。",
  },
  {
    id: "swap",
    name: "移形",
    cost: 4,
    once: true,
    mark: "⇄",
    desc: "交换两枚己方非将帅棋子，须满足区域限制。",
  },
  {
    id: "revive",
    name: "援军",
    cost: 5,
    once: true,
    mark: "援",
    desc: "复活一枚被吃的己方兵卒至空着的初始兵位。",
  },
];
const other = (c) => (c === "r" ? "b" : "r"),
  xy = (i) => [i % 9, Math.floor(i / 9)],
  idx = (x, y) => y * 9 + x,
  inside = (x, y) => x >= 0 && x < 9 && y >= 0 && y < 10;
export function initial(mode = "classic", loadout = ["horse", "dash", "swap"]) {
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
    energy: { r: 2, b: 2 },
    cool: { r: {}, b: {} },
    used: { r: {}, b: {} },
    loadout: { r: [...loadout], b: [...loadout] },
    lost: { r: 0, b: 0 },
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
export function actions(s) {
  const moves = [],
    c = s.turn,
    b = s.board;
  for (let i = 0; i < 90; i++) {
    const p = b[i];
    if (!p || p.c !== c) continue;
    for (const j of raw(b, i))
      if (b[j]?.t !== "k") moves.push({ from: i, to: j });
    for (const id of ["horse", "elephant", "dash", "retreat"])
      if (
        allowed(s, id) &&
        { horse: "h", elephant: "e", dash: "p", retreat: "p" }[id] === p.t
      )
        for (const j of raw(b, i, id))
          if (
            b[j]?.t !== "k" &&
            (id === "dash" || id === "retreat" || !raw(b, i).includes(j))
          )
            moves.push({ from: i, to: j, skill: id });
  }
  if (allowed(s, "swap"))
    for (let i = 0; i < 90; i++)
      if (b[i]?.c === c && b[i].t !== "k")
        for (let j = i + 1; j < 90; j++)
          if (
            b[j]?.c === c &&
            b[j].t !== "k" &&
            b[j].t !== b[i].t &&
            region(b[i], j) &&
            region(b[j], i)
          )
            moves.push({ from: i, to: j, skill: "swap" });
  if (allowed(s, "revive") && s.lost[c] > 0)
    for (let x = 0; x < 9; x += 2) {
      const j = idx(x, c === "r" ? 6 : 3);
      if (!b[j]) moves.push({ from: -1, to: j, skill: "revive" });
    }
  return moves.filter((a) => !inCheck(advance(s, a, false), c));
}
export function key(s) {
  return (
    s.board.map((p) => (p ? p.c + p.t : "_")).join("") +
    s.turn +
    (s.mode === "skills"
      ? JSON.stringify([s.energy, s.cool, s.used, s.lost])
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
    last: a,
  };
  const c = s.turn,
    p = s.board[a.from],
    q = s.board[a.to];
  if (a.skill === "swap") {
    n.board[a.from] = q;
    n.board[a.to] = p;
  } else if (a.skill === "revive") {
    n.board[a.to] = { c, t: "p" };
    n.lost[c]--;
  } else {
    n.board[a.from] = null;
    n.board[a.to] = p;
    if (q?.t === "p") n.lost[q.c]++;
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
    (q && a.skill !== "swap") || p?.t === "p" || a.skill === "revive"
      ? 0
      : s.quiet + 1;
  for (const id of Object.keys(n.cool[n.turn])) {
    n.cool[n.turn][id] = Math.max(0, n.cool[n.turn][id] - 1);
    if (!n.cool[n.turn][id]) delete n.cool[n.turn][id];
  }
  // Both players start their first turn with two points, then regenerate on later turns.
  if (n.mode === "skills" && n.ply > 1)
    n.energy[n.turn] = Math.min(5, n.energy[n.turn] + 1);
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
  const coord = (i) => {
    const [x, y] = xy(i);
    return "ABCDEFGHI"[x] + (10 - y);
  };
  const label = a.skill
    ? SKILLS.find((x) => x.id === a.skill).name + " · "
    : "";
  return (
    label +
    (a.from < 0 ? "兵援军" : pieceName(s.board[a.from]) + " " + coord(a.from)) +
    " → " +
    coord(a.to) +
    (s.board[a.to] && a.skill !== "swap"
      ? " 吃" + pieceName(s.board[a.to])
      : "")
  );
}
