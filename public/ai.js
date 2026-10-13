import { actions, advance, inCheck, casualties } from "./engine.js";
const V = { k: 100000, a: 120, e: 120, h: 300, r: 600, c: 330, p: 70 };
function score(s) {
  let v = 0;
  for (let i = 0; i < 90; i++) {
    const p = s.board[i];
    if (!p) continue;
    const y = Math.floor(i / 9),
      x = i % 9,
      progress = p.c === "r" ? 9 - y : y;
    let n = V[p.t];
    if (p.t === "p") n += progress * 9 + (progress >= 5 ? 55 : 0);
    if (p.t === "h" || p.t === "c") n += 14 - Math.abs(4 - x) * 3;
    n *= p.c === s.turn ? 1 : -1;
    v += n;
  }
  if (s.mode === "skills")
    v += (s.energy[s.turn] - s.energy[s.turn === "r" ? "b" : "r"]) * 7;
  return v;
}
function ordered(s, m) {
  return m.sort((a, b) => {
    const value = (a) =>
      casualties(s, a).reduce(
        (sum, j) => sum + V[s.board[j].t] * (s.board[j].c === s.turn ? -1 : 1),
        0,
      ) *
        10 +
      (a.skill === "retreat" ? (V[s.board[a.to]?.t] || 0) * 18 : 0) +
      (a.skill === "revive" ? (V[a.pieceType] || 0) * 8 : 0) -
      (V[s.board[a.from]?.t] || 0) / 20 -
      (a.skill ? 25 : 0);
    return value(b) - value(a);
  });
}
export function choose(s, difficulty = "medium", budget) {
  const limits = { easy: [1, 220], medium: [3, 700], hard: [4, 1800] },
    [max, ms] = limits[difficulty] || limits.medium,
    end = Date.now() + (budget || ms),
    root = ordered(s, actions(s));
  if (!root.length) return null;
  let best = root[0],
    nodes = 0,
    depthDone = 0;
  function search(n, depth, alpha, beta, ply) {
    ++nodes;
    if (Date.now() > end) throw Error("timeout");
    if (depth === 0 && !inCheck(n)) return score(n);
    const m = ordered(n, actions(n));
    if (!m.length) return -100000 + ply;
    if (depth === 0) return score(n);
    let v = -Infinity;
    for (const a of m) {
      let z = -search(advance(n, a, false), depth - 1, -beta, -alpha, ply + 1);
      v = Math.max(v, z);
      alpha = Math.max(alpha, z);
      if (alpha >= beta) break;
    }
    return v;
  }
  for (let depth = 1; depth <= max; depth++) {
    let candidate = best,
      v = -Infinity;
    try {
      for (const a of root) {
        if (Date.now() > end) throw Error("timeout");
        const n = advance(s, a, false),
          z =
            -search(n, depth - 1, -Infinity, -v, 1) +
            (difficulty === "easy" ? Math.random() * 35 : 0);
        if (z > v) {
          v = z;
          candidate = a;
        }
      }
      best = candidate;
      depthDone = depth;
      root.sort((a, b) => (a === best ? -1 : b === best ? 1 : 0));
    } catch {
      break;
    }
  }
  return { action: best, nodes, depth: depthDone };
}
