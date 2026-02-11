// PM2-Konfiguration für CineVault V2 (Next.js)
// Bei output: standalone → node .next/standalone/server.js (nicht next start)
// cwd: .next/standalone, damit der Server die richtigen Pfade findet

const path = require("path");

const standaloneDir = path.join(__dirname, ".next", "standalone");

module.exports = {
  apps: [
    {
      name: "cinevaultv2",
      script: "server.js",
      cwd: standaloneDir,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      watch: false,
      kill_timeout: 15000,
      listen_timeout: 10000,
    },
  ],
};
