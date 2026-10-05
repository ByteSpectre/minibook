/**
 * PM2 process file: `pm2 start deploy/ecosystem.config.cjs --env production`.
 *
 * The API runs as a single fork-mode instance on purpose: it owns the grammY bot
 * (long polling allows only one consumer) and the node-cron jobs (reminders,
 * evening summaries, autopayments) that must not run twice.
 */
module.exports = {
  apps: [
    {
      name: 'glow-api',
      cwd: __dirname + '/../apps/api',
      script: 'dist/index.js',
      exec_mode: 'fork',
      instances: 1,
      node_args: '--enable-source-maps',
      max_memory_restart: '600M',
      kill_timeout: 10000,
      time: true,
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
