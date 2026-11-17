// PM2 en el VPS: lo arranca deploy/install.sh (pm2 startOrReload deploy/ecosystem.config.cjs && pm2 save)
// Puertos propios para no chocar con los otros sitios del servidor (cambialos si ya están en uso: ss -ltnp).
const API_PORT = process.env.GESETEC_API_PORT || 4130;
const WEB_PORT = process.env.GESETEC_WEB_PORT || 3130;
const ROOT = __dirname + '/..';

module.exports = {
  apps: [
    {
      name: 'gesetec-api',
      cwd: `${ROOT}/apps/api`,
      script: 'dist/main.js',
      env: { NODE_ENV: 'production', PORT: API_PORT, HOST: '127.0.0.1' },
      max_memory_restart: '400M',
      time: true,
    },
    {
      name: 'gesetec-web',
      cwd: `${ROOT}/apps/web`,
      script: `${ROOT}/node_modules/next/dist/bin/next`,
      args: `start -p ${WEB_PORT} -H 127.0.0.1`,
      env: { NODE_ENV: 'production', API_URL: `http://127.0.0.1:${API_PORT}` },
      max_memory_restart: '500M',
      time: true,
    },
  ],
};
