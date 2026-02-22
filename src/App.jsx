import React, { useState, useEffect, useRef, useCallback } from "react";

// ——— Config ———
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws";


// ─── Helpers ──────────────────────────────────────────────────────────────────
const statusColor = {
  collected: "#4ade80", in_transit: "#facc15", at_facility: "#60a5fa",
  processing: "#c084fc", recycled: "#34d399", flagged: "#f87171",
};
const statusBg = {
  collected: "#052e16", in_transit: "#422006", at_facility: "#0c1a3a",
  processing: "#2e1065", recycled: "#022c22", flagged: "#3b0f0f",
};

const fmt = (n) => typeof n === "number" ? n.toLocaleString() : n;
const timeAgo = (iso) => {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
};

// ─── Auth Hook ────────────────────────────────────────────────────────────────
function useAuth() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  const login = async (username, password) => {
    const r = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!r.ok) throw new Error("Invalid credentials");
    const d = await r.json();
    setToken(d.access_token);
    setUser(d.user);
    return d;
  };

  const authFetch = useCallback(async (url, opts = {}) => {
    const r = await fetch(`${API_BASE}${url}`, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts.headers },
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }, [token]);

  return { token, user, login, authFetch, logout: () => { setToken(null); setUser(null); } };
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [creds, setCreds] = useState({ username: "demo", password: "demo123" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setErr("");
    try { await onLogin(creds.username, creds.password); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={styles.loginWrap}>
      <div style={styles.loginNoise} />
      <div style={styles.loginCard}>
        <div style={styles.loginLogo}>
          <span style={styles.logoIcon}>⚡</span>
          <div>
            <div style={styles.logoTitle}>TraceWaste IoT</div>
            <div style={styles.logoSub}>E-Waste Chain-of-Custody Platform</div>
          </div>
        </div>
        <form onSubmit={submit} style={styles.loginForm}>
          {[["username", "text", "USERNAME"], ["password", "password", "PASSWORD"]].map(([k, t, lbl]) => (
            <div key={k} style={styles.fieldWrap}>
              <label style={styles.fieldLabel}>{lbl}</label>
              <input
                type={t} value={creds[k]} autoComplete="off"
                onChange={e => setCreds(p => ({...p, [k]: e.target.value}))}
                style={styles.input}
                onFocus={e => e.target.style.borderColor = "#4ade80"}
                onBlur={e => e.target.style.borderColor = "#2a2a2a"}
              />
            </div>
          ))}
          {err && <div style={styles.loginErr}>{err}</div>}
          <button type="submit" style={styles.loginBtn} disabled={loading}>
            {loading ? "AUTHENTICATING..." : "ACCESS SYSTEM →"}
          </button>
          <div style={styles.demoHint}>Demo: demo / demo123 &nbsp;|&nbsp; admin / hackathon2024</div>
        </form>
      </div>
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, unit, accent = "#4ade80", sub }) {
  return (
    <div style={{...styles.metricCard, borderColor: accent + "44"}}>
      <div style={{...styles.metricAccent, background: accent}} />
      <div style={styles.metricLabel}>{label}</div>
      <div style={{...styles.metricValue, color: accent}}>{fmt(value)}<span style={styles.metricUnit}>{unit}</span></div>
      {sub && <div style={styles.metricSub}>{sub}</div>}
    </div>
  );
}

// ─── Live Feed ────────────────────────────────────────────────────────────────
function LiveFeed({ events }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = 0; }, [events]);

  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <span style={styles.liveTag}>● LIVE</span> IOT EVENT STREAM
      </div>
      <div style={styles.feedScroll} ref={ref}>
        {events.slice(0, 30).map((e, i) => (
          <div key={i} style={{...styles.feedRow, animationDelay: `${i * 0.03}s`}}>
            <span style={styles.feedTime}>{timeAgo(e.timestamp)}</span>
            <span style={{
              ...styles.feedBadge,
              background: e.event === "hazmat_alert" ? "#3b0f0f" : "#0f1f0f",
              color: e.event === "hazmat_alert" ? "#f87171" : "#4ade80",
            }}>
              {(e.event || e.type || "scan").replace("_", " ").toUpperCase()}
            </span>
            <span style={styles.feedId}>{e.device_id}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Device Table ─────────────────────────────────────────────────────────────
function DeviceTable({ devices, onSelect }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? devices : devices.filter(d => d.status === filter);

  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        DEVICE REGISTRY
        <div style={styles.filterRow}>
          {["all", "flagged", "in_transit", "recycled"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{...styles.filterBtn, ...(filter === f ? styles.filterActive : {})}}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>{["ID", "TYPE", "WEIGHT", "HAZARD", "STATUS", "FACILITY", "LAST SEEN"].map(h => (
              <th key={h} style={styles.th}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {filtered.slice(0, 20).map(d => (
              <tr key={d.id} onClick={() => onSelect(d)} style={styles.tr}
                  onMouseEnter={e => e.currentTarget.style.background = "#1a1a1a"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <td style={{...styles.td, color: "#60a5fa", fontFamily: "monospace"}}>{d.id}</td>
                <td style={styles.td}>{d.type}</td>
                <td style={styles.td}>{d.weight_kg}kg</td>
                <td style={styles.td}>
                  <div style={{...styles.hazardBar, width: `${d.hazard_score * 10}%`,
                    background: d.hazard_score > 7 ? "#f87171" : d.hazard_score > 4 ? "#facc15" : "#4ade80"
                  }} />
                  <span style={{color: d.hazard_score > 7 ? "#f87171" : "#aaa"}}>{d.hazard_score}</span>
                </td>
                <td style={styles.td}>
                  <span style={{...styles.statusBadge, background: statusBg[d.status], color: statusColor[d.status]}}>
                    {d.status.replace("_", " ")}
                  </span>
                </td>
                <td style={{...styles.td, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                  {!d.certified_recycler && <span style={{color: "#f87171"}}>⚠ </span>}
                  {d.facility_name}
                </td>
                <td style={{...styles.td, color: "#666"}}>{timeAgo(d.last_seen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Status Donut ─────────────────────────────────────────────────────────────
function StatusDonut({ breakdown }) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  let offset = 0;
  const segments = Object.entries(breakdown).map(([status, count]) => {
    const pct = (count / total) * 100;
    const seg = { status, count, pct, offset };
    offset += pct;
    return seg;
  });

  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>STATUS DISTRIBUTION</div>
      <div style={styles.donutWrap}>
        <svg viewBox="0 0 36 36" style={styles.donut}>
          {segments.map(({ status, pct, offset }) => {
            const dashArray = `${pct} ${100 - pct}`;
            const dashOffset = 25 - offset;
            return (
              <circle key={status} cx="18" cy="18" r="15.9155"
                fill="transparent" stroke={statusColor[status] || "#666"}
                strokeWidth="4" strokeDasharray={dashArray} strokeDashoffset={dashOffset}
              />
            );
          })}
          <text x="18" y="16" textAnchor="middle" fill="#fff" fontSize="4" fontWeight="bold">{total}</text>
          <text x="18" y="21" textAnchor="middle" fill="#666" fontSize="2.5">DEVICES</text>
        </svg>
        <div style={styles.legend}>
          {segments.map(({ status, count, pct }) => (
            <div key={status} style={styles.legendRow}>
              <span style={{...styles.legendDot, background: statusColor[status] || "#666"}} />
              <span style={styles.legendLabel}>{status.replace("_", " ")}</span>
              <span style={styles.legendCount}>{count} ({pct.toFixed(0)}%)</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Alert Panel ─────────────────────────────────────────────────────────────
function AlertPanel({ alerts }) {
  if (!alerts?.length) return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>⚠ ALERTS</div>
      <div style={{padding: "1rem", color: "#4ade80", textAlign: "center"}}>● SYSTEM NOMINAL</div>
    </div>
  );
  return (
    <div style={styles.panel}>
      <div style={{...styles.panelHeader, color: "#f87171"}}>⚠ ACTIVE ALERTS ({alerts.length})</div>
      {alerts.slice(0, 5).map((a, i) => (
        <div key={i} style={styles.alertRow}>
          <div style={styles.alertSev}>{a.severity?.toUpperCase()}</div>
          <div>
            <div style={{color: "#f87171", fontSize: "0.8rem"}}>{a.message}</div>
            <div style={{color: "#666", fontSize: "0.7rem"}}>{a.device_id} · {timeAgo(a.timestamp)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Map Placeholder (SVG dot map) ───────────────────────────────────────────
function DotMap({ devices }) {
  // Simple India bounding box approximation
  const toX = (lng) => ((lng - 68) / (97 - 68)) * 380 + 10;
  const toY = (lat) => ((37 - lat) / (37 - 8)) * 240 + 10;

  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>GEOSPATIAL TRACKING</div>
      <svg viewBox="0 0 400 260" style={styles.mapSvg}>
        <rect width="400" height="260" fill="#0a0a0a" rx="4"/>
        {/* Grid */}
        {[0,1,2,3,4].map(i => <line key={i} x1={i*100} y1="0" x2={i*100} y2="260" stroke="#111" strokeWidth="1"/>)}
        {[0,1,2].map(i => <line key={i} x1="0" y1={i*86} x2="400" y2={i*86} stroke="#111" strokeWidth="1"/>)}
        {/* Devices */}
        {devices.slice(0, 40).map(d => {
          const x = toX(d.lng), y = toY(d.lat);
          if (isNaN(x) || isNaN(y)) return null;
          const col = statusColor[d.status] || "#888";
          return (
            <g key={d.id}>
              <circle cx={x} cy={y} r="6" fill={col} opacity="0.15"/>
              <circle cx={x} cy={y} r="3" fill={col} opacity="0.8"/>
            </g>
          );
        })}
        <text x="10" y="250" fill="#333" fontSize="10">● India Region — {devices.length} devices tracked</text>
      </svg>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
function Dashboard({ authFetch, user, onLogout }) {
  const [summary, setSummary] = useState(null);
  const [devices, setDevices] = useState([]);
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [wsStatus, setWsStatus] = useState("connecting");
  const wsRef = useRef(null);

  const loadData = useCallback(async () => {
    const [s, d] = await Promise.all([
      authFetch("/api/analytics/summary"),
      authFetch("/api/devices"),
    ]);
    setSummary(s);
    setDevices(d.devices);
  }, [authFetch]);

  useEffect(() => {
    loadData();
    const iv = setInterval(loadData, 15000);
    return () => clearInterval(iv);
  }, [loadData]);

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => setWsStatus("live");
      ws.onclose = () => { setWsStatus("reconnecting"); setTimeout(connect, 3000); };
      ws.onerror = () => setWsStatus("error");
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "init") {
          setDevices(msg.devices || []);
          setEvents(msg.recent_events || []);
        } else if (msg.type === "iot_event") {
          setEvents(prev => [msg.payload, ...prev.slice(0, 49)]);
          if (msg.device) {
            setDevices(prev => prev.map(d => d.id === msg.device.id ? msg.device : d));
          }
        } else if (msg.type === "new_device") {
          setDevices(prev => [msg.payload, ...prev]);
        }
      };
    };
    connect();
    return () => wsRef.current?.close();
  }, []);

  if (!summary) return <div style={styles.loading}>INITIALIZING SYSTEMS...</div>;

  return (
    <div style={styles.dashWrap}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.headerIcon}>⚡</span>
          <div>
            <div style={styles.headerTitle}>TRACEWASTE IOT</div>
            <div style={styles.headerSub}>E-Waste Chain-of-Custody · Real-Time Monitoring</div>
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={{...styles.wsIndicator, color: wsStatus === "live" ? "#4ade80" : "#facc15"}}>
            {wsStatus === "live" ? "● LIVE" : "○ " + wsStatus.toUpperCase()}
          </div>
          <div style={styles.userBadge}>{user?.toUpperCase()}</div>
          <button style={styles.logoutBtn} onClick={onLogout}>EXIT</button>
        </div>
      </header>

      {/* Metrics */}
      <div style={styles.metricsRow}>
        <MetricCard label="TOTAL DEVICES" value={summary.total_devices} accent="#60a5fa" sub={`${summary.events_today} events today`}/>
        <MetricCard label="WEIGHT TRACKED" value={summary.total_weight_kg} unit=" kg" accent="#4ade80" sub="IoT-verified"/>
        <MetricCard label="CO₂ SAVED" value={summary.total_co2_saved_kg} unit=" kg" accent="#34d399" sub="vs landfill baseline"/>
        <MetricCard label="FLAGGED" value={summary.flagged_count} accent="#f87171" sub={`${summary.high_hazard_count} high-hazard`}/>
        <MetricCard label="COMPLIANCE" value={summary.compliance_rate} unit="%" accent={summary.compliance_rate > 90 ? "#4ade80" : "#facc15"} sub="certified recyclers"/>
      </div>

      {/* Main Grid */}
      <div style={styles.mainGrid}>
        <div style={styles.colLeft}>
          <StatusDonut breakdown={summary.status_breakdown} />
          <AlertPanel alerts={summary.recent_alerts} />
        </div>
        <div style={styles.colCenter}>
          <DotMap devices={devices} />
          <LiveFeed events={events} />
        </div>
        <div style={styles.colRight}>
          <DeviceTable devices={devices} onSelect={setSelected} />
        </div>
      </div>

      {/* Device Detail Modal */}
      {selected && (
        <div style={styles.overlay} onClick={() => setSelected(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <span style={{color: "#60a5fa", fontFamily: "monospace"}}>{selected.id}</span>
              <button style={styles.closeBtn} onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={styles.modalGrid}>
              {[
                ["Type", selected.type], ["Weight", `${selected.weight_kg} kg`],
                ["Hazard Score", selected.hazard_score], ["RFID Tag", selected.rfid_tag],
                ["Facility", selected.facility_name], ["Certified", selected.certified_recycler ? "✓ YES" : "✗ NO"],
                ["CO₂ Saved", `${selected.co2_saved_kg} kg`], ["Registered", new Date(selected.registered_at).toLocaleDateString()],
              ].map(([k, v]) => (
                <div key={k} style={styles.modalField}>
                  <div style={styles.modalFieldKey}>{k}</div>
                  <div style={{...styles.modalFieldVal, color: k === "Certified" && !selected.certified_recycler ? "#f87171" : "#e5e5e5"}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{...styles.statusBadge, ...{display: "inline-block", margin: "0.5rem 0"}, background: statusBg[selected.status], color: statusColor[selected.status]}}>
              STATUS: {selected.status.replace("_", " ").toUpperCase()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const auth = useAuth();

  // Safety check: If auth hook hasn't initialized, show loading instead of crashing
  if (!auth) {
    return <div style={styles.loading}>INITIALIZING SECURITY MODULES...</div>;
  }

  // If there is no token, show the Login screen
  if (!auth.token) {
    return <LoginScreen onLogin={auth.login} />;
  }

  // If authenticated, show the Dashboard
  return (
    <Dashboard 
      authFetch={auth.authFetch} 
      user={auth.user} 
      onLogout={auth.logout} 
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  // Login
  loginWrap: { minHeight: "100vh", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Mono', 'Courier New', monospace", position: "relative" },
  loginNoise: { position: "fixed", inset: 0, background: "radial-gradient(ellipse at 20% 50%, #0a1f0a 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, #0a0f1f 0%, transparent 60%)", pointerEvents: "none" },
  loginCard: { width: 360, padding: "2.5rem", border: "1px solid #2a2a2a", background: "#0a0a0a", position: "relative", zIndex: 1 },
  loginLogo: { display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "2rem" },
  logoIcon: { fontSize: "2rem", lineHeight: 1 },
  logoTitle: { fontSize: "1.1rem", fontWeight: 700, letterSpacing: "0.15em", color: "#4ade80" },
  logoSub: { fontSize: "0.65rem", color: "#666", letterSpacing: "0.05em", marginTop: 2 },
  loginForm: { display: "flex", flexDirection: "column", gap: "1.25rem" },
  fieldWrap: { display: "flex", flexDirection: "column", gap: "0.35rem" },
  fieldLabel: { fontSize: "0.65rem", letterSpacing: "0.12em", color: "#666" },
  input: { background: "#111", border: "1px solid #2a2a2a", color: "#e5e5e5", padding: "0.6rem 0.75rem", fontFamily: "inherit", fontSize: "0.9rem", outline: "none", transition: "border-color 0.2s" },
  loginErr: { color: "#f87171", fontSize: "0.75rem", padding: "0.5rem", border: "1px solid #3b0f0f", background: "#1a0808" },
  loginBtn: { background: "#4ade80", color: "#000", border: "none", padding: "0.75rem", fontFamily: "inherit", fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.1em", cursor: "pointer" },
  demoHint: { fontSize: "0.65rem", color: "#333", textAlign: "center", letterSpacing: "0.05em" },

  // Dashboard
  dashWrap: { minHeight: "100vh", background: "#060606", fontFamily: "'Space Mono', 'Courier New', monospace", color: "#e5e5e5", display: "flex", flexDirection: "column" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1.5rem", borderBottom: "1px solid #1a1a1a", background: "#080808", flexShrink: 0 },
  headerLeft: { display: "flex", alignItems: "center", gap: "0.75rem" },
  headerIcon: { fontSize: "1.5rem" },
  headerTitle: { fontSize: "1rem", fontWeight: 700, letterSpacing: "0.2em", color: "#4ade80" },
  headerSub: { fontSize: "0.6rem", color: "#555", letterSpacing: "0.08em" },
  headerRight: { display: "flex", alignItems: "center", gap: "1rem" },
  wsIndicator: { fontSize: "0.7rem", letterSpacing: "0.1em", fontWeight: 700 },
  userBadge: { fontSize: "0.65rem", background: "#1a1a1a", padding: "0.25rem 0.6rem", border: "1px solid #2a2a2a", letterSpacing: "0.1em" },
  logoutBtn: { background: "transparent", border: "1px solid #2a2a2a", color: "#666", padding: "0.25rem 0.6rem", fontFamily: "inherit", fontSize: "0.65rem", letterSpacing: "0.1em", cursor: "pointer" },

  // Metrics
  metricsRow: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1px", background: "#111", borderBottom: "1px solid #1a1a1a" },
  metricCard: { padding: "1rem 1.25rem", background: "#060606", borderTop: "2px solid transparent", position: "relative", overflow: "hidden" },
  metricAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 2 },
  metricLabel: { fontSize: "0.6rem", color: "#555", letterSpacing: "0.12em", marginBottom: "0.4rem" },
  metricValue: { fontSize: "1.6rem", fontWeight: 700, lineHeight: 1 },
  metricUnit: { fontSize: "0.75rem", opacity: 0.7, marginLeft: 2 },
  metricSub: { fontSize: "0.6rem", color: "#444", marginTop: "0.3rem" },

  // Panels
  panel: { border: "1px solid #161616", background: "#080808", overflow: "hidden" },
  panelHeader: { padding: "0.6rem 1rem", borderBottom: "1px solid #111", fontSize: "0.65rem", letterSpacing: "0.15em", color: "#666", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" },
  liveTag: { color: "#f87171", animation: "pulse 1.5s infinite" },

  // Grid
  mainGrid: { display: "grid", gridTemplateColumns: "220px 1fr 1fr", gap: "1px", flex: 1, background: "#0e0e0e", overflow: "hidden" },
  colLeft: { display: "flex", flexDirection: "column", gap: "1px", overflow: "hidden" },
  colCenter: { display: "flex", flexDirection: "column", gap: "1px", overflow: "hidden" },
  colRight: { overflow: "hidden" },

  // Live Feed
  feedScroll: { height: 180, overflowY: "auto", padding: "0.25rem 0" },
  feedRow: { display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.25rem 0.75rem", fontSize: "0.7rem", animation: "fadeIn 0.3s ease" },
  feedTime: { color: "#444", minWidth: 50, fontSize: "0.6rem" },
  feedBadge: { padding: "0.1rem 0.4rem", fontSize: "0.55rem", letterSpacing: "0.08em", borderRadius: 2 },
  feedId: { color: "#60a5fa", fontFamily: "monospace", fontSize: "0.65rem" },

  // Table
  tableWrap: { overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 280px)" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" },
  th: { padding: "0.5rem 0.75rem", textAlign: "left", fontSize: "0.6rem", letterSpacing: "0.1em", color: "#555", borderBottom: "1px solid #161616", whiteSpace: "nowrap", position: "sticky", top: 0, background: "#060606", zIndex: 1 },
  tr: { cursor: "pointer", transition: "background 0.1s", borderBottom: "1px solid #0e0e0e" },
  td: { padding: "0.45rem 0.75rem", color: "#bbb", verticalAlign: "middle" },
  hazardBar: { height: 3, borderRadius: 2, marginBottom: 3, transition: "width 0.3s" },
  statusBadge: { padding: "0.15rem 0.5rem", fontSize: "0.6rem", borderRadius: 2, display: "inline-block", letterSpacing: "0.05em" },

  // Filter
  filterRow: { display: "flex", gap: "0.25rem" },
  filterBtn: { background: "transparent", border: "1px solid #1a1a1a", color: "#555", padding: "0.15rem 0.4rem", fontFamily: "inherit", fontSize: "0.55rem", cursor: "pointer", letterSpacing: "0.08em" },
  filterActive: { background: "#1a1a1a", color: "#4ade80", borderColor: "#4ade8044" },

  // Donut
  donutWrap: { display: "flex", alignItems: "center", gap: "1rem", padding: "1rem" },
  donut: { width: 110, height: 110, flexShrink: 0 },
  legend: { flex: 1, display: "flex", flexDirection: "column", gap: "0.3rem" },
  legendRow: { display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.65rem" },
  legendDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  legendLabel: { flex: 1, color: "#888", textTransform: "capitalize" },
  legendCount: { color: "#555", fontSize: "0.6rem" },

  // Alerts
  alertRow: { display: "flex", gap: "0.75rem", padding: "0.6rem 1rem", borderBottom: "1px solid #0e0e0e", alignItems: "flex-start" },
  alertSev: { fontSize: "0.55rem", background: "#3b0f0f", color: "#f87171", padding: "0.15rem 0.4rem", borderRadius: 2, flexShrink: 0, marginTop: 2 },

  // Map
  mapSvg: { width: "100%", display: "block" },

  // Modal
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modal: { background: "#0a0a0a", border: "1px solid #2a2a2a", width: 500, maxWidth: "90vw", padding: "1.5rem" },
  modalHeader: { display: "flex", justifyContent: "space-between", marginBottom: "1.25rem", fontSize: "1rem", fontWeight: 700 },
  closeBtn: { background: "transparent", border: "none", color: "#666", cursor: "pointer", fontSize: "1rem" },
  modalGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem 1.5rem", marginBottom: "1rem" },
  modalField: {},
  modalFieldKey: { fontSize: "0.6rem", color: "#555", letterSpacing: "0.1em", marginBottom: "0.15rem" },
  modalFieldVal: { fontSize: "0.85rem", fontFamily: "monospace" },

  // Misc
  loading: { display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "monospace", color: "#4ade80", background: "#060606", letterSpacing: "0.2em", fontSize: "0.8rem" },
};
