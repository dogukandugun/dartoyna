module.exports = {
  apps: [{
    name: 'dartoyna',
    script: 'server/index.js',
    env: { NODE_ENV: 'production', PORT: 3000 },
    restart_delay: 1000,
    max_restarts: 10,
  }],
};
