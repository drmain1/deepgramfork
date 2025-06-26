#!/bin/bash

# Restart Backend Script
# Use this when the backend loses connection to Google Cloud services after being idle

echo "🔄 Restarting backend server..."

# Find and kill the existing Python process
echo "📍 Finding existing backend process..."
PID=$(ps aux | grep "[p]ython main.py" | awk '{print $2}')

if [ ! -z "$PID" ]; then
    echo "🛑 Stopping backend process (PID: $PID)..."
    kill -TERM $PID
    sleep 2
    
    # Force kill if still running
    if ps -p $PID > /dev/null; then
        echo "⚠️  Process didn't stop gracefully, force killing..."
        kill -KILL $PID
    fi
else
    echo "ℹ️  No existing backend process found"
fi

# Navigate to backend directory
cd backend

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    echo "🐍 Activating virtual environment..."
    source venv/bin/activate
fi

# Start the backend server
echo "🚀 Starting backend server..."
nohup python main.py > ../backend.log 2>&1 &

# Get the new PID
NEW_PID=$!
echo "✅ Backend started with PID: $NEW_PID"

# Wait a moment and check if it's running
sleep 3
if ps -p $NEW_PID > /dev/null; then
    echo "✅ Backend is running successfully!"
    echo "📄 Logs are being written to backend.log"
    echo ""
    echo "To view logs in real-time:"
    echo "  tail -f backend.log"
else
    echo "❌ Backend failed to start. Check backend.log for errors."
    tail -20 ../backend.log
fi