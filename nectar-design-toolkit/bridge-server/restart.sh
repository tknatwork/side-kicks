#!/bin/bash

# Safe Restart Script for Nectar Bridge Server
# Usage: ./restart.sh

PORT=9877

echo "🔄 Restarting Bridge Server..."

# 1. Find and Kill process on port 9877
PID=$(lsof -t -i:$PORT)

if [ -n "$PID" ]; then
  echo "⚠️  Found existing process (PID: $PID) on port $PORT. Killing it..."
  kill -9 $PID
  echo "✅ Process killed."
else
  echo "✅ No existing process found on port $PORT."
fi

# 2. Start the server
echo "🚀 Starting Bridge Server..."
# We use nohup to keep it running if this script exits, or just run it directly if in a terminal
# For this environment, we'll just run it in the background
node index.js &

echo "✅ Bridge Server started in background."
echo "📡 Listening on http://localhost:$PORT"
