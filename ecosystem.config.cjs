// PM2-Konfiguration für CineVault V2 (Next.js)
// Wrapper start-standalone.cjs lädt .env (inkl. NEXT_SERVER_ACTIONS_ENCRYPTION_KEY),
// damit keine "Failed to find Server Action"-Fehler auftreten.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS config, require ist hier Standard */

const path = require("path");

module.exports = {
  apps: [
    {
      name: "cinevaultv2",
      script: path.join(__dirname, "scripts", "start-standalone.cjs"),
      cwd: __dirname,
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
