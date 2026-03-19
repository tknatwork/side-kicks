module.exports = {
  apps: [
    {
      name: 'nectar-orchestration',
      script: 'orchestration-server/index.js',
      cwd: __dirname,
      watch: ['orchestration-server'],
      ignore_watch: ['node_modules', 'logs', '*.log'],
      env: {
        NODE_ENV: 'development'
      },
      log_file: './logs/orchestration.log',
      out_file: './logs/orchestration-out.log',
      error_file: './logs/orchestration-error.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000
    }
  ]
};
