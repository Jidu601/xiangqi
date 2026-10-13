import { spawnSync } from "node:child_process";
const r = spawnSync("git", ["credential", "fill"], {
  input: "protocol=https\nhost=github.com\n\n",
  encoding: "utf8",
  env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" },
});
const token = r.stdout?.match(/^password=(.*)$/m)?.[1];
if (!token) throw Error("No stored GitHub credential available");
const headers = {
  Authorization: "Bearer " + token,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "Content-Type": "application/json",
};
const name = "xiangqi";
const exists = await fetch("https://api.github.com/repos/Jidu601/" + name, {
  headers,
});
if (exists.ok) {
  console.log("Repository exists: " + (await exists.json()).html_url);
} else if (exists.status === 404) {
  const res = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers,
    body: JSON.stringify({
      name,
      description: "楚河·奇谋：水墨风象棋，经典与技能模式，浏览器人机对战",
      private: false,
    }),
  });
  const j = await res.json();
  if (!res.ok) throw Error("GitHub API " + res.status + " " + j.message);
  console.log("Created " + j.html_url);
} else throw Error("GitHub API " + exists.status);
