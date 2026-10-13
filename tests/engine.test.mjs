import test from "node:test";
import assert from "node:assert/strict";
import {
  initial,
  actions,
  advance,
  inCheck,
  outcome,
  key,
} from "../public/engine.js";
import { choose } from "../public/ai.js";
const i = (x, y) => y * 9 + x,
  has = (s, f, t, skill) =>
    actions(s).some(
      (a) =>
        a.from === f && a.to === t && (a.skill || null) === (skill || null),
    );
function sparse(mode = "classic", loadout = ["horse", "elephant", "dash"]) {
  const s = initial(mode, loadout);
  s.board = Array(90).fill(null);
  s.board[4] = { c: "b", t: "k" };
  s.board[85] = { c: "r", t: "k" };
  s.board[49] = { c: "r", t: "p" };
  return s;
}
test("标准开局有 32 枚棋子及 44 种合法走法", () => {
  const s = initial();
  assert.equal(s.board.filter(Boolean).length, 32);
  assert.equal(actions(s).length, 44);
});

test("炮必须隔一子吃子", () => {
  const s = sparse();
  s.board[i(0, 7)] = { c: "r", t: "c" };
  s.board[i(0, 3)] = { c: "b", t: "r" };
  assert.equal(has(s, i(0, 7), i(0, 3)), false);
  s.board[i(0, 5)] = { c: "r", t: "p" };
  assert.equal(has(s, i(0, 7), i(0, 3)), true);
  s.board[i(0, 4)] = { c: "b", t: "p" };
  assert.equal(has(s, i(0, 7), i(0, 3)), false);
});
test("兵过河才可横走，不能后退", () => {
  const s = sparse();
  s.board[i(0, 6)] = { c: "r", t: "p" };
  assert.equal(has(s, i(0, 6), i(1, 6)), false);
  s.board[i(0, 4)] = { c: "r", t: "p" };
  assert.equal(has(s, i(0, 4), i(1, 4)), true);
  assert.equal(has(s, i(0, 4), i(0, 5)), false);
});
test("将帅照面时不能移开唯一阻挡", () => {
  const s = sparse();
  s.board[85] = null;
  s.board[86] = { c: "r", t: "k" };
  s.board[49] = null;
  s.board[4] = null;
  s.board[5] = { c: "b", t: "k" };
  s.board[50] = { c: "r", t: "r" };
  assert.equal(has(s, 50, 51), false);
});

test("将死及困毙均判负", () => {
  const s = sparse();
  s.turn = "b";
  s.board[49] = null;
  s.board[3] = { c: "r", t: "r" };
  s.board[12] = { c: "r", t: "r" };
  s.board[5] = { c: "r", t: "r" };
  s.board[14] = { c: "r", t: "r" };
  s.board[22] = { c: "r", t: "r" };
  assert.equal(outcome(s).winner, "r");
});
test("三次重复和棋与单方长将判负", () => {
  const s = initial(),
    k = key(s);
  s.records = [
    { key: k, turn: "r", check: false },
    { key: "other", turn: "b", check: false },
    { key: k, turn: "r", check: false },
    { key: "other", turn: "b", check: false },
    { key: k, turn: "r", check: false },
  ];
  assert.equal(outcome(s).winner, null);
  s.records[1].check = s.records[3].check = true;
  assert.equal(outcome(s).winner, "b");
});
test("两个模式的 AI 合法行动、不修改状态、可连续对弈", () => {
  for (const mode of ["classic", "skills"]) {
    let s = initial(mode);
    for (let n = 0; n < 8; n++) {
      const before = JSON.stringify(s),
        r = choose(s, "easy", 100);
      assert.ok(r);
      assert.ok(
        actions(s).some((a) => JSON.stringify(a) === JSON.stringify(r.action)),
      );
      assert.equal(JSON.stringify(s), before);
      s = advance(s, r.action);
      assert.equal(inCheck(s, s.turn === "r" ? "b" : "r"), false);
    }
  }
});

test("传统马腿与象眼仍生效", () => {
  const s = sparse();
  s.board[64] = { c: "r", t: "h" };
  s.board[55] = { c: "r", t: "p" };
  assert.equal(has(s, 64, 47), false);
  s.board[63] = { c: "r", t: "e" };
  s.board[55] = { c: "r", t: "p" };
  assert.equal(has(s, 63, 47), false);
});
test("天马行空全盘瞬移，不可直接吃子", () => {
  const s = sparse("skills");
  s.board[64] = { c: "r", t: "h" };
  s.board[55] = { c: "r", t: "p" };
  assert.ok(has(s, 64, 18, "horse"));
  s.board[18] = { c: "b", t: "r" };
  assert.equal(has(s, 64, 18, "horse"), false);
});
test("火炮轰天可跨全盘，误伤计入墓地，将帅免疫", () => {
  const s = sparse("skills");
  s.board[70] = { c: "r", t: "c" };
  s.board[3] = { c: "b", t: "r" };
  s.board[12] = { c: "b", t: "h" };
  s.board[2] = { c: "r", t: "p" };
  const a = actions(s).find(
    (a) => a.skill === "dash" && a.from === 70 && a.to === 3,
  );
  assert.ok(a);
  const n = advance(s, a);
  assert.equal(n.board[3], null);
  assert.equal(n.board[12], null);
  assert.equal(n.board[2], null);
  assert.equal(n.board[4].t, "k");
  assert.equal(n.board[70].t, "c");
  assert.deepEqual(n.grave.b.sort(), ["h", "r"]);
  assert.equal(n.lost.r, 1);
});
test("轰炸不能炸开将帅照面或留下己方被将军", () => {
  const s = sparse("skills");
  s.board[70] = { c: "r", t: "c" };
  s.board[48] = { c: "b", t: "r" };
  assert.equal(has(s, 70, 48, "dash"), false);
});
test("横扫千军只清除落点邻近敌子，己方和将帅免疫", () => {
  const s = sparse("skills");
  s.board[81] = { c: "r", t: "r" };
  s.board[55] = { c: "b", t: "h" };
  s.board[46] = { c: "r", t: "p" };
  const a = actions(s).find(
    (a) => a.from === 81 && a.to === 54 && a.skill === "elephant",
  );
  assert.ok(a);
  const n = advance(s, a);
  assert.equal(n.board[55], null);
  assert.equal(n.board[46].c, "r");
  assert.equal(n.board[54].t, "r");
});
test("偷天换日原地策反车马炮兵，不消耗棋子，不可策反将帅", () => {
  const s = sparse("skills", ["retreat", "swap", "revive"]);
  s.energy.r = 10;
  s.board[0] = { c: "b", t: "r" };
  const a = actions(s).find((a) => a.skill === "retreat" && a.to === 0);
  assert.ok(a);
  const n = advance(s, a);
  assert.deepEqual(n.board[0], { c: "r", t: "r" });
  assert.equal(n.board.filter(Boolean).length, s.board.filter(Boolean).length);
  assert.equal(n.energy.r, 4);
  assert.equal(
    actions(s).some((a) => a.skill === "retreat" && a.to === 4),
    false,
  );
});
test("乾坤挪移可与敌子交换，士象区域限制仍生效", () => {
  const s = sparse("skills", ["swap", "revive", "retreat"]);
  s.board[81] = { c: "r", t: "r" };
  s.board[0] = { c: "b", t: "h" };
  assert.ok(has(s, 81, 0, "swap"));
  const n = advance(s, { from: 81, to: 0, skill: "swap" });
  assert.equal(n.board[81].c, "b");
  assert.equal(n.board[0].c, "r");
  s.board[83] = { c: "r", t: "e" };
  assert.equal(has(s, 83, 0, "swap"), false);
});
test("起死回生可选大子及兵，落点在己方半场，墓地不能无限复制", () => {
  const s = sparse("skills", ["revive", "swap", "retreat"]);
  s.grave.r = ["r", "h", "p"];
  s.lost.r = 1;
  const a = actions(s).find(
    (a) => a.skill === "revive" && a.to === 81 && a.pieceType === "r",
  );
  assert.ok(a);
  assert.equal(
    actions(s).some((a) => a.skill === "revive" && a.to < 45),
    false,
  );
  const n = advance(s, a);
  assert.deepEqual(n.board[81], { c: "r", t: "r" });
  assert.deepEqual(n.grave.r, ["h", "p"]);
  assert.equal(n.lost.r, 1);
});
test("双方初始资源公平，快速恢复和冷却，输入不变", () => {
  let s = initial("skills");
  const before = JSON.stringify(s),
    a = actions(s).find((a) => a.skill === "horse");
  assert.ok(a);
  let n = advance(s, a);
  assert.equal(n.energy.r, 3);
  assert.equal(n.energy.b, 5);
  assert.equal(n.cool.r.horse, 2);
  n = advance(n, actions(n)[0]);
  assert.equal(n.energy.r, 6);
  assert.equal(n.cool.r.horse, 1);
  assert.equal(JSON.stringify(s), before);
  n = advance(
    n,
    actions(n).find((a) => !a.skill),
  );
  n = advance(
    n,
    actions(n).find((a) => !a.skill),
  );
  assert.equal(n.cool.r.horse, undefined);
  assert.equal(n.energy.r, 9);
});
test("经典模式不产生任何娱乐技能", () => {
  const s = initial("classic");
  s.energy.r = 10;
  s.grave.r = ["r"];
  assert.equal(
    actions(s).some((a) => a.skill),
    false,
  );
});
test("AI 会主动选择远程轰炸多个高价值敌子", () => {
  const s = sparse("skills");
  s.board[70] = { c: "r", t: "c" };
  s.board[0] = { c: "b", t: "r" };
  s.board[1] = { c: "b", t: "r" };
  s.board[9] = { c: "b", t: "h" };
  const r = choose(s, "easy", 300);
  assert.equal(r.action.skill, "dash");
  const n = advance(s, r.action);
  assert.equal(n.grave.b.length, 3);
});
test("三组技能搭配的人机对弈均合法并能主动释放技能", () => {
  for (const loadout of [
    ["horse", "dash", "retreat"],
    ["elephant", "swap", "revive"],
  ]) {
    let s = initial("skills", loadout),
      cast = 0;
    for (let step = 0; step < 8; step++) {
      const r = choose(s, "easy", 150);
      if (!r) break;
      assert.ok(
        actions(s).some((a) => JSON.stringify(a) === JSON.stringify(r.action)),
      );
      if (r.action.skill) cast++;
      s = advance(s, r.action);
      assert.equal(inCheck(s, s.turn === "r" ? "b" : "r"), false);
    }
    assert.ok(cast > 0);
  }
});
