#!/bin/bash
# RainToday — Launch script for macOS
# Starts local server and opens in default browser

PORT=8000
DIR="$(cd "$(dirname "$0")" && pwd)"

# Kill any existing server on this port
lsof -ti:$PORT | xargs kill -9 2>/dev/null

# Start server in background
cd "$DIR"
python3 -m http.server $PORT &

# Wait for server to be ready
sleep 1

# Open in default browser
open "http://localhost:$PORT"
