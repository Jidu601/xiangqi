import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import net from "node:net";
const require = createRequire("D:/xm/gpt/mcp_ssh_manager/package.json");
const { Client } = require("ssh2");
const text = readFileSync("D:/xm/gpt/mcp_ssh_manager/ssh-config.toml", "utf8");
const section = text.split("[ssh_servers.cloud]")[1].split("\n[")[0];
const val = (k) =>
  section.match(new RegExp("^" + k + '\\s*=\\s*"([^"]*)"', "m"))?.[1];
const conn = new Client();
conn
  .on("error", (e) => {
    console.error("SSH: " + e.message);
    process.exitCode = 1;
  })
  .on("ready", () => {
    const command = process.argv[2];
    conn.exec(command, (err, stream) => {
      if (err) {
        console.error(err.message);
        conn.end();
        process.exitCode = 1;
        return;
      }
      stream.on("data", (d) => process.stdout.write(d));
      stream.stderr.on("data", (d) => process.stderr.write(d));
      stream.on("close", (code) => {
        process.exitCode = code;
        conn.end();
      });
    });
  });
const options = {
  host: val("host"),
  port: 22,
  username: val("username") || val("user"),
  password: val("password"),
  readyTimeout: 20000,
};
if (process.argv.includes("--proxy")) {
  const sock = net.connect(7897, "127.0.0.1");
  sock.on("error", (e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
  sock.once("connect", () =>
    sock.write(
      "CONNECT " +
        options.host +
        ":22 HTTP/1.1\r\nHost: " +
        options.host +
        ":22\r\n\r\n",
    ),
  );
  let pending = Buffer.alloc(0);
  const receive = (d) => {
    pending = Buffer.concat([pending, d]);
    const end = pending.indexOf("\r\n\r\n");
    if (end < 0) return;
    sock.off("data", receive);
    if (!pending.toString().startsWith("HTTP/1.1 200")) {
      console.error("Proxy refused tunnel");
      sock.destroy();
      process.exitCode = 1;
      return;
    }
    const rest = pending.subarray(end + 4);
    if (rest.length) sock.unshift(rest);
    conn.connect({ ...options, sock });
  };
  sock.on("data", receive);
} else conn.connect(options);
