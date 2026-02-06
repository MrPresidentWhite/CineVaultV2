// PM2-Konfiguration für CineVault V2 (Next.js)
// Start: next start aus Projektroot (.env wird dort geladen)

module.exports = {
  apps: [
    {
      name: "cinevaultv2",
      script: "node_modules/.bin/next",
      args: "start",
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
