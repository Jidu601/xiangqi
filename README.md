# 楚河·奇谋

水墨风浏览器象棋小游戏，经典象棋与技能象棋两种模式，均支持人机对战。六种技能任选三种，资源与冷却公开，人机遵守相同规则。

## 本地运行
需要 Node.js 22 或更新版本，无第三方运行依赖。

```sh
npm start
# http://localhost:3188
npm run check
npm test
```

本地启动入口：Windows 双击 `启动楚河奇谋.cmd`。

支持选边、三档难度、限时、悔棋、提示、棋谱导出、回看、自动存档及手机布局。设置模式、阵营、时间与携带技能后点击「开启新局」生效。

## 部署
Dockerfile 提供非 root 容器及健康检查。部署于现有 Caddy 登录网关 `/games/xiangqi/`，不向公网额外开放服务端口。连接、主页卡片与截图更新均需先检查实际服务器配置，保留内容卷和网关备份。

`public/cover.jpg` 为实际游戏截图。规则与 AI 验证见 `tests/engine.test.mjs`，参考项目及未覆盖的竞赛规则见 [docs/research.md](docs/research.md)。

部署操作脚本在 `scripts/`，只读取本机既有凭据且不输出凭据；配置与存档不提交到 GitHub。
