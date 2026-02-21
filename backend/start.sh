#!/bin/bash
# TraceWaste IoT - Ubuntu Quick Deploy
# =====================================
set -e

echo ""
echo "⚡ TraceWaste IoT - E-Waste Chain-of-Custody Platform"
echo "======================================================"
echo ""

MODE=${1:-"dev"}

if [ "$MODE" = "docker" ]; then
  echo "▶ Docker deployment..."
  if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    sudo apt-get update -q && sudo apt-get install -y docker.io docker-compose-v2
    sudo usermod -aG docker $USER
  fi
  docker compose up --build -d
  echo ""
  echo "✓ Running at: http://localhost:3000"
  echo "✓ API docs:   http://localhost:8000/docs"
  exit 0
fi

# Dev mode
echo "▶ Installing dependencies..."

# Backend
echo "[1/3] Python backend..."
cd backend
python3 -m venv .venv 2>/dev/null || true
source .venv/bin/activate
pip install -q -r requirements.txt
echo "  ✓ Backend ready"

# Frontend
echo "[2/3] Node.js dashboard..."
cd ../dashboard
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
npm install --silent
echo "  ✓ Dashboard ready"

# Launch
echo "[3/3] Launching..."
cd ..

(cd backend && source .venv/bin/activate && python main.py) &
BACKEND_PID=$!

sleep 1
(cd dashboard && npm run dev -- --port 3000 --host 0.0.0.0) &
FRONTEND_PID=$!

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  ⚡ TraceWaste IoT RUNNING            ║"
echo "║  Dashboard → http://localhost:3000   ║"
echo "║  API Docs  → http://localhost:8000/docs ║"
echo "║  Login: demo / demo123              ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "Press Ctrl+C to stop all services"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" SIGINT SIGTERM
wait
