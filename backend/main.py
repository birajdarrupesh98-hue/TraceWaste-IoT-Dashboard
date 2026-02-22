"""
E-Waste IoT Tracking Backend
==============================
Solves: Chain-of-custody gaps in e-waste recycling
Stack: FastAPI + WebSocket + JWT + simulated MQTT IoT sensors
"""

import asyncio
import json
import random
import time
import hashlib
import hmac
from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import uvicorn

import os
from dotenv import load_dotenv

# This command looks for your .env file and loads the keys
load_dotenv() 

# Now you can use your new secure key
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")

origins = [
    "http://localhost:3000",
    "https://your-project-name.vercel.app", # Add your Vercel link here
]


# 1. IMPORTS (Always first)
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# ... keep your other imports like 'uvicorn' or 'json'

# 2. LIFESPAN HANDLER (The new logic)
@asynccontextmanager
async def lifespan(app: FastAPI):
    # This runs when you type 'python Main.py'
    print("🚀 IoT System Starting: Initializing background tasks...")
    yield 
    # This runs when you press 'Ctrl + C'
    print("🛑 IoT System Shutting Down: Cleaning up resources...")

# 3. APP INITIALIZATION (Pass the lifespan here)
app = FastAPI(lifespan=lifespan)

# 4. CORS SETTINGS (Very important for your React App to connect)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, change this to your Vercel URL
    allow_methods=["*"],
    allow_headers=["*"],
)

# 5. YOUR ROUTES (Everything else follows)
# @app.get("/") ...
# @app.post("/api/auth/login") ...
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware  # 1. Add this import

app = FastAPI()

# 2. Update this list with your ACTUAL Vercel link
origins = [
    "http://localhost:3000",
    "http://localhost:5173", # Standard Vite port
    "https://waste-management-ui.vercel.app", # Replace with your real Vercel URL
]

# 3. Add the middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ... your @app.get("/") and other routes stay below here ...








# ─── JWT Config ────────────────────────────────────────────────────────────────
SECRET_KEY = "ewaste-iot-hackathon-secret-2024"
ALGORITHM = "HS256"

def create_token(data: dict) -> str:
    import base64
    payload = {**data, "exp": (datetime.utcnow() + timedelta(hours=8)).timestamp()}
    header = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').decode().rstrip("=")
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    sig = hmac.new(SECRET_KEY.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest()
    return f"{header}.{body}.{base64.urlsafe_b64encode(sig).decode().rstrip('=')}"

def verify_token(token: str) -> dict:
    try:
        import base64
        parts = token.split(".")
        body = parts[1] + "=="
        payload = json.loads(base64.urlsafe_b64decode(body))
        if payload.get("exp", 0) < time.time():
            raise ValueError("Token expired")
        return payload
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

security = HTTPBearer()

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    return verify_token(creds.credentials)

# ─── App Setup ─────────────────────────────────────────────────────────────────
app = FastAPI(title="E-Waste IoT API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ─── In-Memory Data Store (demo) ───────────────────────────────────────────────
DEVICES = {}
EVENTS = []
ALERTS = []

# E-waste device types
DEVICE_TYPES = ["Laptop", "Smartphone", "CRT Monitor", "Server Rack", "Battery Pack",
                "Tablet", "Printer", "Hard Drive", "PCB Board", "Power Supply"]

FACILITIES = [
    {"id": "F001", "name": "GreenCycle Hub - Pune", "lat": 18.5204, "lng": 73.8567, "certified": True},
    {"id": "F002", "name": "TechReclaim Mumbai", "lat": 19.0760, "lng": 72.8777, "certified": True},
    {"id": "F003", "name": "EcoDispose Bangalore", "lat": 12.9716, "lng": 77.5946, "certified": False},
    {"id": "F004", "name": "SafeShred Delhi", "lat": 28.6139, "lng": 77.2090, "certified": True},
    {"id": "F005", "name": "CircularTech Chennai", "lat": 13.0827, "lng": 80.2707, "certified": True},
]

STATUSES = ["collected", "in_transit", "at_facility", "processing", "recycled", "flagged"]
STATUS_COLORS = {
    "collected": "#4ade80", "in_transit": "#facc15", "at_facility": "#60a5fa",
    "processing": "#c084fc", "recycled": "#34d399", "flagged": "#f87171"
}

def generate_device_id():
    return "EW-" + "".join(random.choices("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", k=8))

def init_demo_data():
    for i in range(40):
        dev_id = generate_device_id()
        facility = random.choice(FACILITIES)
        status = random.choice(STATUSES)
        weight = round(random.uniform(0.3, 45.0), 2)
        hazard_score = round(random.uniform(0, 10), 1)
        
        DEVICES[dev_id] = {
            "id": dev_id,
            "type": random.choice(DEVICE_TYPES),
            "weight_kg": weight,
            "hazard_score": hazard_score,
            "status": status,
            "facility_id": facility["id"],
            "facility_name": facility["name"],
            "lat": facility["lat"] + random.uniform(-0.05, 0.05),
            "lng": facility["lng"] + random.uniform(-0.05, 0.05),
            "registered_at": (datetime.now() - timedelta(days=random.randint(0, 30))).isoformat(),
            "last_seen": datetime.now().isoformat(),
            "rfid_tag": "RFID-" + "".join(random.choices("0123456789ABCDEF", k=12)),
            "certified_recycler": facility["certified"],
            "co2_saved_kg": round(weight * random.uniform(1.2, 3.8), 2),
        }
    
    # Seed some events
    for dev_id in list(DEVICES.keys())[:15]:
        for _ in range(random.randint(1, 4)):
            EVENTS.append({
                "id": len(EVENTS),
                "device_id": dev_id,
                "event_type": random.choice(["scan", "status_change", "weight_verified", "hazmat_detected"]),
                "timestamp": (datetime.now() - timedelta(hours=random.randint(0, 72))).isoformat(),
                "data": {"note": "IoT sensor auto-logged"},
                "facility_id": DEVICES[dev_id]["facility_id"],
            })

init_demo_data()

# ─── WebSocket Manager ─────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.append(ws)

    def disconnect(self, ws: WebSocket):
        self.connections.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.connections:
            try:
                await ws.send_json(data)
            except:
                dead.append(ws)
        for ws in dead:
            self.connections.remove(ws)

manager = ConnectionManager()

# ─── IoT Simulator (MQTT-like) ─────────────────────────────────────────────────
async def iot_simulator():
    """Simulates IoT sensor messages arriving from field devices"""
    await asyncio.sleep(2)
    while True:
        await asyncio.sleep(random.uniform(1.5, 4.0))
        
        if not DEVICES:
            continue
            
        dev_id = random.choice(list(DEVICES.keys()))
        device = DEVICES[dev_id]
        event_type = random.choices(
            ["scan", "status_change", "weight_verified", "hazmat_alert", "gps_update"],
            weights=[40, 20, 20, 5, 15]
        )[0]
        
        update = {"device_id": dev_id, "timestamp": datetime.now().isoformat(), "event": event_type}
        
        if event_type == "status_change":
            new_status = random.choice(STATUSES)
            DEVICES[dev_id]["status"] = new_status
            update["new_status"] = new_status
            
        elif event_type == "gps_update":
            DEVICES[dev_id]["lat"] += random.uniform(-0.002, 0.002)
            DEVICES[dev_id]["lng"] += random.uniform(-0.002, 0.002)
            update["lat"] = DEVICES[dev_id]["lat"]
            update["lng"] = DEVICES[dev_id]["lng"]
            
        elif event_type == "hazmat_alert":
            DEVICES[dev_id]["hazard_score"] = min(10, DEVICES[dev_id]["hazard_score"] + random.uniform(0.5, 2))
            alert = {
                "id": len(ALERTS),
                "device_id": dev_id,
                "type": "HAZMAT",
                "message": f"High hazard material detected in {device['type']}",
                "severity": "high" if device["hazard_score"] > 7 else "medium",
                "timestamp": datetime.now().isoformat(),
            }
            ALERTS.append(alert)
            update["alert"] = alert
            if not DEVICES[dev_id]["certified_recycler"]:
                DEVICES[dev_id]["status"] = "flagged"
        
        DEVICES[dev_id]["last_seen"] = datetime.now().isoformat()
        EVENTS.append({"id": len(EVENTS), "device_id": dev_id, **update, "facility_id": DEVICES[dev_id]["facility_id"]})
        
        await manager.broadcast({"type": "iot_event", "payload": update, "device": DEVICES[dev_id]})

@app.on_event("startup")
async def startup():
    asyncio.create_task(iot_simulator())

# ─── Auth Endpoints ────────────────────────────────────────────────────────────
@app.post("/api/auth/login")
async def login(body: dict):
    users = {"admin": "hackathon2024", "demo": "demo123", "auditor": "audit456"}
    if body.get("username") in users and users[body["username"]] == body.get("password"):
        token = create_token({"sub": body["username"], "role": "admin"})
        return {"access_token": token, "token_type": "bearer", "user": body["username"]}
    raise HTTPException(status_code=401, detail="Invalid credentials")

# ─── Device Endpoints ──────────────────────────────────────────────────────────
@app.get("/api/devices")
async def list_devices(status: Optional[str] = None, user=Depends(get_current_user)):
    devs = list(DEVICES.values())
    if status:
        devs = [d for d in devs if d["status"] == status]
    return {"devices": devs, "total": len(devs)}

@app.get("/api/devices/{device_id}")
async def get_device(device_id: str, user=Depends(get_current_user)):
    if device_id not in DEVICES:
        raise HTTPException(404, "Device not found")
    device_events = [e for e in EVENTS if e["device_id"] == device_id]
    return {"device": DEVICES[device_id], "events": sorted(device_events, key=lambda x: x["timestamp"], reverse=True)[:20]}

@app.post("/api/devices/register")
async def register_device(body: dict, user=Depends(get_current_user)):
    dev_id = generate_device_id()
    facility = next((f for f in FACILITIES if f["id"] == body.get("facility_id")), FACILITIES[0])
    DEVICES[dev_id] = {
        "id": dev_id,
        "type": body.get("type", "Unknown"),
        "weight_kg": body.get("weight_kg", 1.0),
        "hazard_score": 0.0,
        "status": "collected",
        "facility_id": facility["id"],
        "facility_name": facility["name"],
        "lat": facility["lat"],
        "lng": facility["lng"],
        "registered_at": datetime.now().isoformat(),
        "last_seen": datetime.now().isoformat(),
        "rfid_tag": "RFID-" + "".join(random.choices("0123456789ABCDEF", k=12)),
        "certified_recycler": facility["certified"],
        "co2_saved_kg": 0,
    }
    await manager.broadcast({"type": "new_device", "payload": DEVICES[dev_id]})
    return {"device": DEVICES[dev_id]}

# ─── Analytics ─────────────────────────────────────────────────────────────────
@app.get("/api/analytics/summary")
async def analytics_summary(user=Depends(get_current_user)):
    devs = list(DEVICES.values())
    status_counts = {}
    for d in devs:
        status_counts[d["status"]] = status_counts.get(d["status"], 0) + 1
    
    total_weight = sum(d["weight_kg"] for d in devs)
    total_co2 = sum(d["co2_saved_kg"] for d in devs)
    flagged = [d for d in devs if d["status"] == "flagged"]
    high_hazard = [d for d in devs if d["hazard_score"] > 7]
    uncertified = [d for d in devs if not d["certified_recycler"]]
    
    return {
        "total_devices": len(devs),
        "total_weight_kg": round(total_weight, 2),
        "total_co2_saved_kg": round(total_co2, 2),
        "status_breakdown": status_counts,
        "flagged_count": len(flagged),
        "high_hazard_count": len(high_hazard),
        "uncertified_facility_count": len(uncertified),
        "recycled_count": status_counts.get("recycled", 0),
        "compliance_rate": round((len(devs) - len(flagged)) / max(len(devs), 1) * 100, 1),
        "facilities": FACILITIES,
        "recent_alerts": ALERTS[-10:][::-1],
        "events_today": len([e for e in EVENTS if e["timestamp"][:10] == datetime.now().strftime("%Y-%m-%d")]),
    }

@app.get("/api/facilities")
async def get_facilities(user=Depends(get_current_user)):
    enriched = []
    for f in FACILITIES:
        f_devs = [d for d in DEVICES.values() if d["facility_id"] == f["id"]]
        enriched.append({**f, "device_count": len(f_devs), "weight_kg": round(sum(d["weight_kg"] for d in f_devs), 2)})
    return {"facilities": enriched}

# ─── WebSocket ─────────────────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial state
        await websocket.send_json({
            "type": "init",
            "devices": list(DEVICES.values()),
            "recent_events": EVENTS[-20:][::-1],
        })
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/health")
async def health():
    return {"status": "ok", "devices": len(DEVICES), "events": len(EVENTS)}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
