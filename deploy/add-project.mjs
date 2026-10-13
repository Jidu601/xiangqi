// Run inside the existing personal-web container after the game route passes health checks.
const base = process.env.SITE_URL,
  password = process.env.ADMIN_PASSWORD;
if (!base || !/^https:\/\//.test(base))
  throw Error("SITE_URL must be the existing HTTPS homepage");
if (!password)
  throw Error(
    "Existing ADMIN_PASSWORD is required for the content API. Do not change credentials; update through the administrator UI when only a password hash is configured.",
  );
const api = "http://127.0.0.1:3000",
  headers = {
    "Content-Type": "application/json",
    Origin: new URL(base).origin,
  };
async function json(route, options = {}) {
  const r = await fetch(api + route, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  const j = await r.json();
  if (!r.ok) throw Error("Homepage API " + r.status + ": " + j.error);
  return { r, j };
}
const login = await json("/api/login", {
  method: "POST",
  body: JSON.stringify({ password }),
});
const cookie = login.r.headers.get("set-cookie").split(";")[0];
headers.Cookie = cookie;
headers["X-CSRF-Token"] = login.j.csrf;
try {
  const { j: doc } = await json("/api/content"),
    site = doc.site;
  const url = new URL("/games/xiangqi/", base).href;
  let cover = site.projects.find((p) => p.id === "chuhe-qimou")?.cover;
  if (!cover) {
    const image = await fetch("http://xiangqi:3188/cover.jpg");
    if (!image.ok) throw Error("Game screenshot is unavailable");
    const bytes = await image.arrayBuffer();
    const uploaded = await fetch(api + "/api/upload", {
      method: "POST",
      headers: { ...headers, "Content-Type": "image/jpeg" },
      body: bytes,
    });
    const j = await uploaded.json();
    if (!uploaded.ok) throw Error("Cover upload failed: " + uploaded.status);
    cover = j.url;
  }
  const project = {
    id: "chuhe-qimou",
    name: "楚河·奇谋",
    description:
      "水墨风象棋小游戏。经典象棋与技能象棋双模式，均可人机对战；六种奇谋自由组合，支持悔棋、提示、回看与自动存档。",
    link: url,
    cover,
    skills: ["象棋", "人机对战", "技能策略", "水墨风"],
    category: "互动游戏",
    year: "2026",
    published: true,
  };
  site.projects = [
    project,
    ...site.projects.filter((p) => p.id !== project.id),
  ];
  site.sections.projects = true;
  const { j: saved } = await json("/api/content", {
    method: "PUT",
    body: JSON.stringify({ site, revision: doc.revision }),
  });
  console.log(
    JSON.stringify({
      revision: saved.revision,
      project: project.name,
      url,
      cover,
      otherProjects: site.projects.length - 1,
    }),
  );
} finally {
  await json("/api/logout", { method: "POST", body: "{}" });
}
