import { useState } from "react";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#070D1A", surface: "#0A1220", card: "#0E1929", border: "#1A3050",
  amber: "#F59E0B", blue: "#3B82F6", green: "#22C55E", red: "#EF4444",
  purple: "#A78BFA", teal: "#2DD4BF", pink: "#F472B6",
  text: "#E2E8F0", sub: "#94A3B8", muted: "#475569", dim: "#1E3555",
};

// ─── Shared Components ────────────────────────────────────────────────────────
const Badge = ({ type, label }) => {
  const map = {
    must:   ["#7F1D1D", C.red,    "MUST"],
    should: ["#78350F", C.amber,  "SHOULD"],
    could:  ["#1E3A8A", C.blue,   "COULD"],
    oss:    ["#134E4A", C.teal,   "OPEN SOURCE"],
    free:   ["#4C1D95", C.purple, "FREE TIER"],
  };
  const [bg, color, fallback] = map[type] || map.should;
  return (
    <span style={{
      background: bg + "88", color, border: `1px solid ${bg}`,
      padding: "1px 6px 2px", borderRadius: 2, fontSize: 9,
      fontFamily: "monospace", fontWeight: 800, letterSpacing: "0.1em",
      whiteSpace: "nowrap", flexShrink: 0,
    }}>{label || fallback}</span>
  );
};

const Req = ({ p, children }) => (
  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.border}44` }}>
    <div style={{ paddingTop: 2 }}><Badge type={p} /></div>
    <span style={{ color: C.sub, fontSize: 13, lineHeight: 1.7, flex: 1 }}>{children}</span>
  </div>
);

const H2 = ({ children }) => (
  <h2 style={{ fontSize: 20, fontWeight: 700, color: C.amber, margin: "0 0 14px", paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
    {children}
  </h2>
);

const H3 = ({ children, color }) => (
  <h3 style={{ fontSize: 11, fontWeight: 700, color: color || "#7DD3FC", margin: "22px 0 8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
    {children}
  </h3>
);

const P = ({ children }) => (
  <p style={{ color: C.sub, lineHeight: 1.75, marginBottom: 14, fontSize: 14 }}>{children}</p>
);

const Mono = ({ children }) => (
  <code style={{ fontFamily: "monospace", background: C.surface, color: C.purple, padding: "1px 5px", borderRadius: 3, fontSize: 12 }}>
    {children}
  </code>
);

const InfoBox = ({ children, color }) => (
  <div style={{ background: C.card, border: `1px solid ${color || C.border}`, borderRadius: 6, padding: 14, margin: "14px 0" }}>
    <div style={{ color: C.sub, fontSize: 13, lineHeight: 1.65 }}>{children}</div>
  </div>
);

const THead = ({ cols }) => (
  <thead>
    <tr style={{ background: "#08111E" }}>
      {cols.map(c => (
        <th key={c} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: "0.06em", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{c}</th>
      ))}
    </tr>
  </thead>
);

const TTable = ({ cols, children, style }) => (
  <div style={{ overflowX: "auto", marginTop: 10, marginBottom: 4 }}>
    <table style={{ width: "100%", borderCollapse: "collapse", background: C.card, borderRadius: 6, ...style }}>
      <THead cols={cols} />
      <tbody>{children}</tbody>
    </table>
  </div>
);

const TR = ({ cells }) => (
  <tr style={{ borderBottom: `1px solid ${C.border}44` }}>
    {cells.map((cell, i) => (
      <td key={i} style={{ padding: "8px 12px", fontSize: 12, verticalAlign: "top", color: i === 0 ? C.muted : C.sub, lineHeight: 1.55 }}>
        {typeof cell === "string" ? cell : cell}
      </td>
    ))}
  </tr>
);

// ─── Nav ─────────────────────────────────────────────────────────────────────
const NAV = [
  { id: "overview", label: "Project Overview" },
  { id: "stack",    label: "Technology Stack" },
  { id: "modules",  label: "Module Requirements" },
  { id: "data",     label: "Data Models" },
  { id: "apis",     label: "API Integrations" },
  { id: "nfr",      label: "Non-Functional Req." },
  { id: "mvp",      label: "MVP Phases" },
];

// ─── SECTION: Overview ────────────────────────────────────────────────────────
function Overview() {
  return (
    <div>
      <H2>Amravati FTO Management Platform</H2>
      <P>A purpose-built, multi-base flight training management system for a DGCA-regulated FTO operating 34 aircraft from a central hub (Amravati) and two satellite bases under India's CAR-ML airworthiness and Safety Management System (SMS) regulations.</P>

      {/* Stats strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
        {[
          ["34", "Aircraft", C.amber],
          ["3",  "Bases",    C.blue],
          ["7",  "User Roles", C.green],
          ["DGCA", "CAR-ML / SMS", C.purple],
        ].map(([v, l, c]) => (
          <div key={l} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: c, fontFamily: "monospace", lineHeight: 1 }}>{v}</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{l}</div>
          </div>
        ))}
      </div>

      <H3>Critical System Constraints</H3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
        {[
          ["Hub-and-Spoke Maintenance",   "Amravati is the sole heavy maintenance facility. All 100-hr, 200-hr, and annual checks must return here. Satellite bases are line-maintenance only."],
          ["Ferry Buffer Algorithm",       "Aircraft at satellite bases must retain ≥ ferry-flight hours (2.5 hr) before their mandatory inspection cutoff — the system must enforce this automatically."],
          ["Offline Tablet Dispatch",      "The apron Dispatch App must operate fully without internet for ≥ 8 hours and auto-sync on Wi-Fi reconnect. Aprons and cockpits are dead zones."],
          ["DGCA Hard Constraints",        "Expired SPL, Medical certificate, or AOG status must physically block scheduling — no bypass or override permitted for any user role."],
          ["Real-time AOG Propagation",    "A No-Go snag at any base must instantly remove the aircraft from all future roster slots network-wide and alert the Amravati CAMO desk."],
          ["Density Altitude Warnings",    "System calculates Density Altitude from live METAR (temp + pressure) and flags dangerous afternoon flights for the Amravati summer heat."],
        ].map(([t, d]) => (
          <div key={t} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, marginBottom: 6 }}>{t}</div>
            <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.65 }}>{d}</div>
          </div>
        ))}
      </div>

      <H3>User Roles & Access</H3>
      <TTable cols={["Role", "Primary Responsibilities", "Module Access"]}>
        {[
          ["Chief Flight Instructor (CFI)",  "Schedule approval, instructor oversight, safety culture",      "All modules — admin"],
          ["Instructor (CFI / FI)",          "Brief students, dispatch flights, grade sorties post-flight",  "Roster, TMS, Dispatch"],
          ["Dispatcher / Operations",        "Assign aircraft, generate briefing packets, monitor fleet",    "Roster, Fleet, Dispatch"],
          ["Student Pilot",                  "View schedule, logbook totals, syllabus progress",             "Student portal (read-only)"],
          ["CAMO Manager",                   "CRS sign-offs, airworthiness records, AD/SB tracking",        "Fleet, Maintenance, Inventory"],
          ["Safety & Compliance Officer",    "SMS occurrence register, DGCA audit dashboard",               "Compliance, SMS, Reporting"],
          ["Finance Manager",                "INR billing, EMI tracking, GST invoice generation",           "Finance module"],
        ].map(([r, p, a]) => (
          <tr key={r} style={{ borderBottom: `1px solid ${C.border}44` }}>
            <td style={{ padding: "8px 12px", fontSize: 13, color: C.text, fontWeight: 500, whiteSpace: "nowrap" }}>{r}</td>
            <td style={{ padding: "8px 12px", fontSize: 12, color: C.sub }}>{p}</td>
            <td style={{ padding: "8px 12px" }}><Mono>{a}</Mono></td>
          </tr>
        ))}
      </TTable>
    </div>
  );
}

// ─── SECTION: Tech Stack ──────────────────────────────────────────────────────
function Stack() {
  const backendRows = [
    ["API Framework",         "django 4.2 + djangorestframework",  "oss",  "Mature ORM handles complex multi-join scheduling queries; built-in admin panel; strong RBAC ecosystem"],
    ["Primary Database",      "postgresql 16",                     "oss",  "ACID transactions; JSONB for flexible snag data; complex index strategies for scheduling conflict detection"],
    ["Cache / Message Broker","redis 7-alpine",                    "oss",  "Celery task broker; WebSocket channel layer; AOG alert pub/sub across all bases in real time"],
    ["Background Tasks",      "celery[redis]",                     "oss",  "Weather polling every 30 min; NOTAM refresh; document expiry alerts; logbook hour recalculation"],
    ["WebSocket / Real-time", "channels[daphne]",                  "oss",  "Pushes AOG status changes to all connected dispatchers instantly without page refresh"],
    ["File / Doc Storage",    "minio (S3-compatible)",             "oss",  "Self-hosted object store for PDFs, tech logs, signed certificates — no vendor lock-in"],
    ["JWT Auth",              "djangorestframework-simplejwt",     "oss",  "15-min access token + 7-day refresh rotation; works identically for web and mobile"],
    ["API Docs",              "drf-spectacular (OpenAPI 3.1)",     "oss",  "Auto-generates API contract; essential for frontend team and future third-party integrations"],
    ["Task Monitoring",       "flower (celery dashboard)",         "oss",  "Monitor background task health — weather polling failures become visible immediately"],
  ];
  const frontendRows = [
    ["UI Framework",   "react 18 + typescript",         "oss",  "Strong typing prevents safety logic errors; shared type definitions with backend OpenAPI schema"],
    ["Build Tool",     "vite 5",                        "oss",  "Sub-second HMR; optimal code splitting by module (lazy load Maintenance unless CAMO user)"],
    ["Styling",        "tailwindcss",                   "oss",  "Utility-first; consistent design tokens; no CSS maintenance burden across 4 modules"],
    ["Server Cache",   "@tanstack/react-query v5",      "oss",  "Automatic refetch when window regains focus; stale-while-revalidate for live fleet status"],
    ["Global State",   "zustand",                       "oss",  "Lightweight store for active base, selected aircraft, modal state — no Redux boilerplate"],
    ["Scheduling UI",  "fullcalendar + @fullcalendar/react", "oss", "Drag-and-drop multi-resource roster; timeline view per base; resource grouping by aircraft type"],
    ["Charts / KPIs",  "recharts",                      "oss",  "React-native SVG; DGCA audit dashboard, fleet utilization, instructor load charts"],
    ["PDF Generation", "@react-pdf/renderer",           "oss",  "Client-side briefing packet + logbook PDF; no server round-trip needed"],
    ["Form Validation","react-hook-form + zod",         "oss",  "Zod schemas mirror Django serializer rules; share validation logic — one source of truth"],
  ];
  const mobileRows = [
    ["Framework",        "react-native + expo sdk 51",      "oss",  "Cross-platform on Android tablets; shares all business logic and Zod schemas with web"],
    ["Offline Database", "watermelondb",                    "oss",  "Observable SQLite; stores 8 hr of dispatch clearances offline; syncs on Wi-Fi reconnect"],
    ["Biometric Auth",   "expo-local-authentication",       "oss",  "PIN / Fingerprint for Tech Log sign-off on apron — OS-level, biometric data never stored remotely"],
    ["Push Alerts",      "expo-notifications + FCM",        "free", "AOG alerts pushed to instructor phones; 500k messages/day free on Firebase"],
    ["Secure Storage",   "expo-secure-store",               "oss",  "Encrypted local storage for JWT tokens on shared dispatch tablets"],
  ];
  const infraRows = [
    ["Containerisation",  "docker + docker compose",             "oss",  "One command to reproduce dev or production stack; service isolation"],
    ["Reverse Proxy/SSL", "nginx + certbot (Let's Encrypt)",    "oss",  "Free TLS certificates; handles API routing, WebSocket upgrade, static file serving"],
    ["CI / CD",           "github actions",                     "free", "Automated tests on PR; deploy on merge to main; zero additional cost"],
    ["Monitoring",        "grafana + prometheus",               "oss",  "API latency, Celery queue depth, active WebSocket connections, AOG event tracking"],
    ["Log Management",    "loki",                              "oss",  "Centralised logs with tamper-evident audit trail required for DGCA CAR-ML compliance"],
    ["Recommended Host",  "hetzner cx31 (4 vCPU / 8 GB RAM)", "—",    "≈ ₹1,800/month · sufficient for 3 bases + 100 concurrent users + all background tasks"],
  ];

  const Section = ({ title, rows }) => (
    <>
      <H3>{title}</H3>
      <TTable cols={["Component", "Package / Library", "Type", "Justification"]}>
        {rows.map(([comp, pkg, type, why]) => (
          <tr key={comp} style={{ borderBottom: `1px solid ${C.border}44` }}>
            <td style={{ padding: "8px 12px", fontSize: 12, color: C.muted, whiteSpace: "nowrap" }}>{comp}</td>
            <td style={{ padding: "8px 12px" }}><Mono>{pkg}</Mono></td>
            <td style={{ padding: "8px 12px" }}><Badge type={type} /></td>
            <td style={{ padding: "8px 12px", fontSize: 12, color: C.sub, lineHeight: 1.55 }}>{why}</td>
          </tr>
        ))}
      </TTable>
    </>
  );

  return (
    <div>
      <H2>Technology Stack</H2>
      <P>Every component is open-source with free self-hosting. Total infrastructure cost is approximately <strong style={{ color: C.green }}>₹2,000–3,000 / month</strong>. No vendor lock-in, full data sovereignty on Indian servers.</P>
      <Section title="Backend" rows={backendRows} />
      <Section title="Frontend — Web App" rows={frontendRows} />
      <Section title="Mobile / Tablet — Dispatch App" rows={mobileRows} />
      <Section title="Infrastructure" rows={infraRows} />
      <InfoBox color={C.amber + "55"}>
        <strong style={{ color: C.amber }}>Monorepo structure recommendation:</strong> Use a single Git repo with three packages: <Mono>packages/backend</Mono> (Django), <Mono>packages/web</Mono> (React), <Mono>packages/mobile</Mono> (React Native). Share Zod validation schemas and TypeScript types via a <Mono>packages/shared</Mono> package. This ensures backend and frontend never drift out of sync on data shapes.
      </InfoBox>
    </div>
  );
}

// ─── SECTION: Modules ─────────────────────────────────────────────────────────
function Modules() {
  const [mod, setMod] = useState("A");
  const tabs = [
    { id: "A", label: "A · Roster & Scheduling",   color: C.amber },
    { id: "B", label: "B · Student & Training",    color: C.blue },
    { id: "C", label: "C · Flight Dispatch & Ops", color: C.green },
    { id: "D", label: "D · Compliance & Maint.",   color: C.purple },
  ];

  return (
    <div>
      <H2>Module Requirements</H2>
      <P>Requirements are tagged <Badge type="must" /> (non-negotiable — safety or legal), <Badge type="should" /> (required for MVP), or <Badge type="could" /> (planned future enhancement).</P>
      <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setMod(t.id)} style={{
            padding: "8px 14px", background: mod === t.id ? t.color + "22" : C.card,
            border: `1px solid ${mod === t.id ? t.color : C.border}`,
            borderRadius: 6, color: mod === t.id ? t.color : C.sub,
            cursor: "pointer", fontSize: 12, fontWeight: mod === t.id ? 700 : 400, transition: "all 0.12s",
          }}>{t.label}</button>
        ))}
      </div>

      {mod === "A" && (
        <div>
          <P><strong style={{ color: C.amber }}>Dynamic Roster & Scheduling Engine</strong> — The central "brain." Must be a conflict-resolution engine, not a simple calendar — it prevents human error before it happens.</P>
          <H3 color={C.amber}>Smart Rule Engine (Hard Blocks)</H3>
          <Req p="must">Block a sortie from being confirmed if the student's Medical Certificate (Class 1 or 2) is expired or absent from the system. No exceptions, no bypass.</Req>
          <Req p="must">Block scheduling if the student's Student Pilot Licence (SPL) is expired or not uploaded and verified.</Req>
          <Req p="must">Block scheduling if the assigned Instructor (CFI/FI) would breach their DGCA FDTL daily, weekly, or monthly duty time limits with the addition of this flight.</Req>
          <Req p="must">Block scheduling if the aircraft's next mandatory inspection threshold (50-hr, 100-hr, 200-hr, or annual) falls within the proposed sortie's flight duration.</Req>
          <Req p="must">Block scheduling if the aircraft's AOG flag is active anywhere in the system, regardless of the base requesting the flight.</Req>
          <Req p="must"><strong>Ferry Buffer Rule:</strong> Block training assignments at a satellite base if the aircraft has fewer remaining hours than the ferry-flight time back to Amravati (configurable per base — default 2.5 hr). This is a hard safety rule, not a warning.</Req>
          <H3 color={C.amber}>Multi-Base Visibility</H3>
          <Req p="must">Dispatcher view defaults to their assigned base. A "Fleet View" toggle shows all bases simultaneously on a unified roster timeline.</Req>
          <Req p="must">Every aircraft, instructor, and student record carries a "Home Base" field. Temporary repositioning creates an auditable transfer record with reason and expected return date.</Req>
          <Req p="should">Drag-and-drop aircraft or instructor reassignment between bases on the roster, with automatic conflict-check validation on drop.</Req>
          <Req p="should">7-day rolling schedule view showing projected maintenance hour burn-down per aircraft — highlights which aircraft at satellite bases are approaching their ferry buffer threshold.</Req>
          <Req p="should">Automated ferry flight roster block generation when an aircraft triggers its ferry buffer limit, prompting dispatch to assign a ferry instructor.</Req>
          <H3 color={C.amber}>Environmental Triggers</H3>
          <Req p="should">Calculate Density Altitude in real time using live METAR temperature and pressure altitude from the departure aerodrome. Display prominently on the dispatch dashboard.</Req>
          <Req p="should">Flag (or optionally block, configurable by CFI) solo sorties by students below a set experience threshold when Density Altitude exceeds a configurable ceiling (default: 6,500 ft DA).</Req>
          <Req p="could">Aircraft Swap Pairing: when a satellite base ferry is auto-generated, prompt dispatch to coordinate a return pairing with a freshly-maintained aircraft from Amravati.</Req>
          <Req p="could">AI-based schedule optimisation: suggest daily rosters that maximise student throughput while respecting all hard constraints and instructor rest requirements.</Req>
        </div>
      )}

      {mod === "B" && (
        <div>
          <P><strong style={{ color: C.blue }}>Student & Training Management System (TMS)</strong> — Manages the complete student lifecycle from enrolment to CPL issuance, fully aligned to the DGCA-approved training curriculum.</P>
          <H3 color={C.blue}>Syllabus & Grading</H3>
          <Req p="must">Store the full DGCA-approved PPL/CPL training curriculum as a structured hierarchy: Stages → Lessons → Exercises (e.g., Stage 2 → Lesson 4 → Exercise: Steep Turns).</Req>
          <Req p="must">Instructors must be able to grade individual exercises on a 1–5 scale with qualitative text comments, directly on the tablet within 5 minutes of landing.</Req>
          <Req p="must">Prerequisite enforcement: system blocks scheduling for Exercise N if Exercise N-1 has not been graded satisfactorily (grade ≥ 3, or CFI-defined pass threshold).</Req>
          <Req p="must">Auto-calculate and update logbook totals after each completed sortie: Cross-Country, Night Flying, PIC, Dual, Solo, Instrument hours — broken down to DGCA licence issuance requirements.</Req>
          <H3 color={C.blue}>Document & Expiry Management</H3>
          <Req p="must">Track expiry dates for all mandatory documents: Medical Certificate (Class 1 & 2), Student Pilot Licence (SPL), FRTOL (Radio Licence), and ATPL/CPL theory credits.</Req>
          <Req p="must">Automated email + push notification alerts to student and CFI at 60 days and 30 days before any document expires. At expiry, scheduling block activates automatically.</Req>
          <Req p="must">Digital upload and version-control of all certificates — full history retained for DGCA audit. Documents stored in MinIO with tamper-evident metadata.</Req>
          <H3 color={C.blue}>Financial Management</H3>
          <Req p="should">Track course fees in INR with GST calculation (18% on training services; store exemptions per student/course type).</Req>
          <Req p="should">EMI payment plan management: configurable instalment schedule with automated due-date reminders via SMS and email.</Req>
          <Req p="should">Generate GST-compliant invoices as PDF (HSN code 999293) on each payment received.</Req>
          <Req p="could">eGCA portal logbook export: auto-generate bulk-upload CSV in the DGCA-required format for monthly submission.</Req>
          <Req p="could">Flight-hour-triggered billing: auto-generate invoice when logged hours reach a billing milestone (e.g., every 10 hours in a block-hour contract).</Req>
        </div>
      )}

      {mod === "C" && (
        <div>
          <P><strong style={{ color: C.green }}>Flight Dispatch & Operations</strong> — The real-time safety gatekeeper. Every aircraft release passes through this module. It is the digital replacement for the paper Tech Log.</P>
          <H3 color={C.green}>Digital Tech Log</H3>
          <Req p="must">Each sortie begins with the CFI accepting the aircraft via PIN or biometric on the tablet at the aircraft. This is the legally binding "Aircraft Acceptance" moment.</Req>
          <Req p="must">Snag entry must force the CFI to classify each defect as "Go" (deferred, safe to fly under MEL) or "No-Go" (aircraft unairworthy — operation must cease).</Req>
          <Req p="must">A "No-Go" snag submission must: (a) immediately set aircraft AOG flag, (b) remove it from all roster slots across all bases, (c) notify the Amravati CAMO desk via push + email within 60 seconds.</Req>
          <Req p="must">Hobbs (engine time) and Tacho (airframe time) recorded on dispatch and return. System auto-calculates sortie duration and deducts from the aircraft's maintenance countdown clock.</Req>
          <Req p="must">The tablet Dispatch App must cache the full dispatch clearance package offline (Tech Log, aircraft status, student/instructor details). All entry works offline. Auto-syncs on Wi-Fi reconnect.</Req>
          <H3 color={C.green}>Pre-Flight Briefing Packet</H3>
          <Req p="must">Auto-generate a single-page digital briefing packet per flight containing: current METAR, TAF (24-hr), route-specific NOTAMs, and calculated Density Altitude.</Req>
          <Req p="must">Before dispatch is cleared, the instructor must digitally sign the acknowledgement: <em>"I have reviewed the Weather, NOTAMs, and mass/balance data for this sortie."</em> Stored with timestamp — forms DGCA audit trail.</Req>
          <Req p="should">Validate live wind speed/direction against the student's approved solo crosswind limits from their syllabus profile. Block solo dispatch if limits are exceeded.</Req>
          <Req p="should">Include DigitalSky drone restriction zone overlay (Red/Yellow zones) near the planned route, fetched from DGCA's API.</Req>
          <Req p="should">Density Altitude high-priority warning banner shown to both dispatcher and CFI when DA exceeds the configured threshold for Amravati operations.</Req>
          <H3 color={C.green}>Post-Flight Loop</H3>
          <Req p="must">After landing, CFI enters ending Hobbs and Tacho. System auto-calculates duration, updates aircraft hours counter, and checks if any maintenance threshold has been crossed.</Req>
          <Req p="must">Tech Log must be closed (either "Nil Defects" or with a snag entry) before the aircraft can be re-dispatched to the next sortie.</Req>
          <Req p="should">Ferry Flight Management: dedicated workflow to create non-training ferry flight records (Amravati ↔ satellite bases), separate from training sorties in all reports.</Req>
        </div>
      )}

      {mod === "D" && (
        <div>
          <P><strong style={{ color: C.purple }}>Compliance & Maintenance (CAR-ML & SMS)</strong> — Ensures DGCA audit-readiness and continuous airworthiness of all 34 aircraft, managed from the Amravati hub.</P>
          <H3 color={C.purple}>Fleet Maintenance (CAMO Hub)</H3>
          <Req p="must">Track every aircraft's hours, cycles, and calendar time against each mandatory threshold: 50-hr, 100-hr, 200-hr, 600-hr, and Annual/biennial inspections.</Req>
          <Req p="must">Track Airworthiness Directives (ADs) and Service Bulletins (SBs) per tail number with compliance status (Pending / Complied / Not Applicable) and due dates.</Req>
          <Req p="must">Electronic Certificate of Release to Service (CRS): only CAMO-credentialled users at Amravati can issue CRS. CRS issuance instantly sets aircraft status to "Airworthy" and makes it schedulable network-wide.</Req>
          <Req p="must">Maintenance engineer shift and duty time tracking — DGCA CAR-M requires fatigue management records for AMEs performing maintenance releases.</Req>
          <H3 color={C.purple}>Hub-and-Spoke Inventory</H3>
          <Req p="should">Central Stores (Amravati): track high-value components (engines, propellers, alternators) and bulk consumables with minimum stock alerts and order history.</Req>
          <Req p="should">Satellite Flyaway Kits: track consumption of line-maintenance items (spark plugs, oil, tyres) at satellite bases. Auto-generate a requisition order to Amravati stores when stock falls below the minimum — delivered on the next ferry flight or by transport.</Req>
          <Req p="could">Part cost tracking for maintenance billing: attribute component costs to specific aircraft for total operating cost reporting per tail.</Req>
          <H3 color={C.purple}>Safety Management System (SMS)</H3>
          <Req p="must">Live Occurrence Register: timestamped digital incident reporting with mandatory structured fields (event type, severity category, contributing factors, immediate actions). Immutable after 48 hours.</Req>
          <Req p="must">Occurrence reports must be exportable in DGCA SMS portal format. The system generates required periodic safety reports automatically.</Req>
          <Req p="should">Audit-Ready Dashboard: real-time scoring against the DGCA 100-point FTO ranking system, identifying specific compliance gaps with actionable remediation steps per finding.</Req>
          <Req p="could">Hazard Register and risk matrix (Severity × Likelihood) for proactive SMS hazard management beyond reactive occurrence reporting.</Req>
        </div>
      )}
    </div>
  );
}

// ─── SECTION: Data Models ─────────────────────────────────────────────────────
function DataModels() {
  const entities = [
    { name: "Base",              color: C.amber,  fields: ["id", "name", "icao_code", "is_hub", "lat", "lng", "ferry_buffer_hours"] },
    { name: "Aircraft",          color: C.blue,   fields: ["tail_number", "type", "home_base_id", "hobbs_total", "tacho_total", "aog_status", "current_base_id", "next_inspection_at_hours", "next_inspection_at_date"] },
    { name: "Instructor",        color: C.green,  fields: ["user_id", "license_number", "home_base_id", "fdtl_daily_remaining", "fdtl_weekly_remaining", "fdtl_monthly_remaining", "medical_expiry", "atpl_expiry"] },
    { name: "Student",           color: C.pink,   fields: ["user_id", "home_base_id", "spl_number", "spl_expiry", "medical_class", "medical_expiry", "frtol_expiry", "total_hours_pic", "total_hours_dual", "total_hours_xc", "total_hours_night"] },
    { name: "Flight",            color: C.purple, fields: ["student_id", "instructor_id", "aircraft_id", "base_id", "syllabus_exercises[]", "scheduled_start", "scheduled_end", "status", "is_ferry"] },
    { name: "TechLog",           color: C.teal,   fields: ["flight_id", "aircraft_id", "hobbs_out", "tacho_out", "hobbs_in", "tacho_in", "accepted_by_id", "accepted_at", "briefing_acknowledged_at", "weather_snapshot_id", "status"] },
    { name: "SnagEntry",         color: C.red,    fields: ["tech_log_id", "description", "category (Go/No-Go)", "ata_chapter", "reported_by_id", "reported_at", "maintenance_record_id"] },
    { name: "MaintenanceRecord", color: C.amber,  fields: ["aircraft_id", "type", "performed_at_hours", "performed_at_date", "base_id", "ame_id", "crs_issued_by_id", "crs_issued_at", "ad_sb_reference", "next_due_hours", "next_due_date"] },
    { name: "SortieGrade",       color: C.blue,   fields: ["flight_id", "exercise_id", "grade (1–5)", "instructor_notes", "graded_by_id", "graded_at"] },
    { name: "OccurrenceReport",  color: C.red,    fields: ["base_id", "aircraft_id", "event_type", "severity", "description", "contributing_factors[]", "immediate_actions", "submitted_by_id", "submitted_at", "locked_at"] },
    { name: "InventoryItem",     color: C.purple, fields: ["base_id", "part_number", "description", "quantity_on_hand", "min_stock_level", "unit_cost_inr", "last_requisition_at"] },
    { name: "WeatherCache",      color: C.teal,   fields: ["icao", "metar_raw", "taf_raw", "density_altitude_ft", "wind_dir", "wind_kt", "temp_c", "qnh_hpa", "fetched_at"] },
  ];

  return (
    <div>
      <H2>Data Models</H2>
      <P>Core PostgreSQL entities. All models include <Mono>created_at</Mono>, <Mono>updated_at</Mono>, and <Mono>created_by_id</Mono> audit fields. Soft-delete (<Mono>is_active = False</Mono>) rather than hard-delete — regulatory data must never be permanently removed.</P>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
        {entities.map(e => (
          <div key={e.name} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: e.color, marginBottom: 8, fontFamily: "monospace" }}>{e.name}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {e.fields.map(f => (
                <span key={f} style={{ fontSize: 10, fontFamily: "monospace", color: C.muted, background: C.surface, padding: "1px 5px", borderRadius: 2 }}>{f}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <H3>Key Relationships & Hard Constraints</H3>
      <TTable cols={["From", "", "To", "Type", "Business Rule Enforced"]}>
        {[
          ["Aircraft",        "→", "Base",             "FK (home_base)",   "Aircraft belongs to a home base. Current location tracked separately to support ferry operations."],
          ["Flight",          "→", "Aircraft + Instructor + Student + Base", "4× FKs", "Scheduling engine validates all four are available and compliant before confirming."],
          ["TechLog",         "↔", "Flight",           "1:1 (OneToOne)",   "Every confirmed flight requires exactly one closed Tech Log before the aircraft can be re-dispatched."],
          ["SnagEntry",       "→", "TechLog",          "M:1 (FK)",         "A No-Go SnagEntry triggers AOG on parent Aircraft and cascades to Rostering Engine."],
          ["SortieGrade",     "→", "Flight",           "M:1 (FK)",         "One grade row per syllabus exercise flown. Missing grade for prerequisite exercise blocks next scheduling."],
          ["MaintenanceRecord","→", "Aircraft",         "M:1 (FK)",         "Full maintenance history per tail. CRS on a record unlocks the Aircraft for scheduling."],
          ["OccurrenceReport","→", "Base + Aircraft",  "FK (nullable)",    "Can be base-level event (no aircraft) or aircraft-specific. Locked after 48 hr — immutable for DGCA."],
          ["InventoryItem",   "→", "Base",             "FK",               "Stock levels tracked per base. Satellite base consumption triggers Amravati requisition order."],
        ].map(([f, ar, t, rel, rule]) => (
          <tr key={f + t} style={{ borderBottom: `1px solid ${C.border}44` }}>
            <td style={{ padding: "8px 12px" }}><Mono>{f}</Mono></td>
            <td style={{ padding: "4px 6px", color: C.amber, fontWeight: 700 }}>{ar}</td>
            <td style={{ padding: "8px 12px" }}><Mono style={{ fontSize: 10 }}>{t}</Mono></td>
            <td style={{ padding: "8px 12px" }}><Badge type="oss" label={rel} /></td>
            <td style={{ padding: "8px 12px", fontSize: 12, color: C.sub, lineHeight: 1.55 }}>{rule}</td>
          </tr>
        ))}
      </TTable>
    </div>
  );
}

// ─── SECTION: APIs ────────────────────────────────────────────────────────────
function APIs() {
  const aviationAPIs = [
    {
      name: "Open-Meteo Aviation Weather",
      url: "api.open-meteo.com",
      cost: "Free",
      data: "METAR, TAF, hourly temperature, wind, QNH, visibility",
      use: "Briefing packet, Density Altitude calculation, wind vs. student crosswind limit check",
      note: "No API key required. 10,000 req/day free. Cache METAR every 30 min via Celery.",
    },
    {
      name: "AAI NOTAM Service / ICAO NOTAMs",
      url: "aim.aai.aero + api.icao.int",
      cost: "Free",
      data: "Active NOTAMs for Indian aerodromes and FIR airspace",
      use: "Route-specific NOTAM filtering in briefing packet; flag restricted airspace for cross-country routes",
      note: "AAI AIS portal + ICAO global NOTAM API. Cache every 60 min. Graceful fallback if unavailable.",
    },
    {
      name: "DigitalSky API (DGCA India)",
      url: "digitalsky.dgca.gov.in/api",
      cost: "Free",
      data: "Red, Yellow, Green drone airspace restriction zones",
      use: "Overlay drone zones near planned route; dispatcher warned of proximity conflicts",
      note: "Government API. Reliability varies — implement fallback to cached zones from previous fetch.",
    },
    {
      name: "DGCA eGCA Portal",
      url: "egca.dgca.gov.in",
      cost: "Free",
      data: "Student logbook submission endpoint",
      use: "Monthly bulk-upload of flight hours in DGCA-mandated format",
      note: "API docs limited. System generates DGCA-format CSV. Direct API sync as stretch goal.",
    },
  ];

  const commAPIs = [
    ["Push Notifications", "firebase / fcm",       "free", "AOG alerts and schedule change pushes to instructor/student phones. 500k messages/day on free tier."],
    ["SMS Alerts (India)", "fast2sms.com or msg91","free", "OTPs and critical alerts via Indian SMS gateway. ~100 free SMS/day. ₹0.12/SMS beyond that."],
    ["Transactional Email","self-hosted postfix",  "oss",  "Document expiry warnings, billing notifications, occurrence acknowledgements. Fully free."],
  ];

  return (
    <div>
      <H2>API Integrations</H2>
      <P>All external data is free-tier or government open-access. Data is cached in PostgreSQL via Celery background tasks — the Dispatch App reads from cache, ensuring offline capability even when external APIs are down.</P>

      <H3>Aviation Data APIs</H3>
      {aviationAPIs.map(api => (
        <div key={api.name} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{api.name}</span>
            <Badge type="free" label={api.cost} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: "5px 12px", fontSize: 12 }}>
            <span style={{ color: C.muted }}>Endpoint</span><Mono>{api.url}</Mono>
            <span style={{ color: C.muted }}>Data</span><span style={{ color: C.sub }}>{api.data}</span>
            <span style={{ color: C.muted }}>Used for</span><span style={{ color: C.sub }}>{api.use}</span>
            <span style={{ color: C.muted }}>Notes</span><span style={{ color: C.amber + "CC", fontSize: 11 }}>{api.note}</span>
          </div>
        </div>
      ))}

      <H3>Communication APIs</H3>
      <TTable cols={["Service", "Provider", "Cost", "Use"]}>
        {commAPIs.map(([svc, prov, type, use]) => (
          <tr key={svc} style={{ borderBottom: `1px solid ${C.border}44` }}>
            <td style={{ padding: "8px 12px", fontSize: 12, color: C.muted }}>{svc}</td>
            <td style={{ padding: "8px 12px" }}><Mono>{prov}</Mono></td>
            <td style={{ padding: "8px 12px" }}><Badge type={type} /></td>
            <td style={{ padding: "8px 12px", fontSize: 12, color: C.sub, lineHeight: 1.55 }}>{use}</td>
          </tr>
        ))}
      </TTable>

      <InfoBox color={C.amber + "55"}>
        <strong style={{ color: C.amber }}>⚠ Caching Strategy (critical for offline):</strong> A Celery beat task runs at <Mono>05:00 local</Mono> every morning, pre-fetching METAR, TAF, and NOTAMs for all three base aerodromes and storing them in <Mono>WeatherCache</Mono> and <Mono>NotamCache</Mono> tables. The tablet app downloads this snapshot during morning Wi-Fi sync, providing full briefing capability even with no internet connectivity on the apron.
      </InfoBox>
    </div>
  );
}

// ─── SECTION: NFR ─────────────────────────────────────────────────────────────
function NFR() {
  const cats = [
    {
      title: "Performance", color: C.blue,
      items: [
        ["Roster page load", "< 2 seconds for 7-day multi-base view with all aircraft and instructors"],
        ["AOG alert propagation", "< 10 seconds from No-Go snag submission to roster update at all bases"],
        ["Briefing packet generation", "< 5 seconds including live weather fetch or cache read"],
        ["Offline tablet sync", "< 30 seconds to push 8 hours of offline Tech Log data on Wi-Fi reconnect"],
        ["Scheduling rule check", "< 500 ms response when confirming a flight — user must not wait"],
      ],
    },
    {
      title: "Availability & Reliability", color: C.green,
      items: [
        ["System uptime target", "99.5% monthly (< 3.6 hours unplanned downtime/month). Excludes announced maintenance windows."],
        ["Database backups", "Automated daily PostgreSQL dumps to MinIO with 90-day retention. Point-in-time recovery capability."],
        ["Offline resilience", "Tablet Dispatch App operates fully offline for minimum 8 hours — non-negotiable for apron operations."],
        ["Graceful API degradation", "If Weather API unavailable, display last cached METAR with timestamp prominently. Operations continue."],
        ["Redis failure", "Django falls back to database sessions. Celery tasks queue to disk. No data loss on Redis restart."],
      ],
    },
    {
      title: "Security", color: C.amber,
      items: [
        ["JWT expiry", "15-minute access token; 7-day refresh token with rotation. Revocable on logout/role change."],
        ["RBAC enforcement", "Permissions checked at the API layer on every request — no frontend-only gating. Role claims in JWT."],
        ["Audit logging", "Every create / update / delete logged: user, timestamp, changed fields, old value, new value. Non-deletable."],
        ["Encryption", "TLS 1.3 in transit; AES-256 at rest in MinIO for all documents. Biometric data processed OS-level only — never stored remotely."],
        ["Rate limiting", "100 req/min per authenticated user; 20 req/min per unauthenticated IP. Protects scheduling endpoint from accidental loops."],
        ["API key rotation", "External API keys (FCM, SMS gateway) stored in environment secrets — not in codebase. Rotatable without deploy."],
      ],
    },
    {
      title: "Regulatory Compliance", color: C.purple,
      items: [
        ["CAR-ML record retention", "All Tech Logs, maintenance records, and CRS documents retained for minimum 2 years. Retrievable by tail number and date range for DGCA audit."],
        ["SMS data immutability", "Occurrence Register entries locked after 48 hours. Digital timestamps court-admissible. No admin deletion permitted."],
        ["Data localisation", "All data stored on India-based or EU-based servers minimum (Hetzner Finland acceptable; avoid US-only data residency)."],
        ["PDPB 2023 compliance", "Student PII encrypted at rest. Explicit consent captured on enrolment. Subject access and deletion request workflow built into admin panel."],
      ],
    },
    {
      title: "Scalability", color: C.teal,
      items: [
        ["Future bases", "All base-scoped queries are parameterised — adding a 4th or 10th base requires zero code changes."],
        ["Fleet growth", "Architecture designed for 100+ aircraft. Aircraft table partitioned by base for query performance at scale."],
        ["Concurrent users", "50 concurrent users at peak morning dispatch window (05:30–07:30 local) without degradation."],
        ["Document growth", "Estimated 1 GB of documents/month at full scale. MinIO scales horizontally with low cost."],
      ],
    },
  ];

  return (
    <div>
      <H2>Non-Functional Requirements</H2>
      <P>These are quality attributes that are as critical as features in a safety-regulated aviation system. A scheduling app that is slow or goes offline at 5 AM is a safety liability.</P>
      {cats.map(({ title, color, items }) => (
        <div key={title}>
          <H3 color={color}>{title}</H3>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
            {items.map(([k, v]) => (
              <div key={k} style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, padding: "10px 14px", borderBottom: `1px solid ${C.border}33`, alignItems: "start" }}>
                <span style={{ fontSize: 11, color, fontFamily: "monospace", paddingTop: 2 }}>{k}</span>
                <span style={{ fontSize: 12, color: C.sub, lineHeight: 1.65 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SECTION: MVP Phases ──────────────────────────────────────────────────────
function MVP() {
  const phases = [
    {
      num: "01", color: C.amber,
      title: "Core Dispatch Loop",
      duration: "Months 1 – 3",
      focus: "Amravati hub only. Make one complete flight lifecycle digital — replacing paper Tech Logs.",
      deliverables: [
        "User management + RBAC (all 7 roles, JWT auth)",
        "Aircraft registry with hours counter (Hobbs + Tacho)",
        "Basic daily roster — manual scheduling, no smart rules yet",
        "Digital Tech Log: Go / No-Go snag entry",
        "AOG flag propagation to roster on No-Go snag",
        "Post-flight hours deduction from maintenance countdown",
        "Student profile with basic logbook totals",
        "React Native tablet app with offline-first dispatch",
      ],
      metric: "Dispatchers stop using paper Tech Logs. Maintenance countdown always current. Zero double-booking.",
    },
    {
      num: "02", color: C.blue,
      title: "Smart Rules & Compliance Engine",
      duration: "Months 4 – 6",
      focus: "Add the intelligence layer that prevents human error before it reaches the aircraft.",
      deliverables: [
        "Smart Rule Engine: Medical, SPL, FDTL, inspection hard blocks on scheduling",
        "Document expiry tracking with 30/60-day automated alerts",
        "Weather + NOTAM + DigitalSky API integration",
        "Pre-flight briefing packet with CFI digital acknowledgement",
        "Density Altitude calculation and warning banner",
        "DGCA-approved syllabus curriculum tree (PPL + CPL stages)",
        "Sortie grading on tablet (1–5 per exercise)",
        "Prerequisite enforcement + automated logbook hour totals",
      ],
      metric: "Zero scheduling of flights with expired Medical or FDTL breach. CFI briefing acknowledgement 100% logged.",
    },
    {
      num: "03", color: C.green,
      title: "Multi-Base & Maintenance Hub",
      duration: "Months 7 – 9",
      focus: "Roll out to satellite bases with full hub-and-spoke maintenance architecture.",
      deliverables: [
        "Ferry Buffer Algorithm enforced per aircraft per satellite base",
        "Auto-generated ferry flight roster block when buffer triggers",
        "Base 2 and Base 3 operator accounts with localized dashboards + Fleet View",
        "CAMO module: CRS electronic sign-off, AD/SB tracking per tail",
        "SMS Occurrence Register with mandatory fields and immutability lock",
        "Satellite inventory kits with auto-requisition to Amravati stores",
        "Maintenance crew shift and fatigue duty-time tracking",
        "DGCA 100-point audit readiness dashboard",
      ],
      metric: "No aircraft trapped at a satellite base past its maintenance limits. CAMO audit score visible at all times.",
    },
    {
      num: "04", color: C.purple,
      title: "Finance, Analytics & Integration",
      duration: "Months 10 – 12",
      focus: "Close the administrative loop, prepare platform for second FTO or additional bases.",
      deliverables: [
        "GST-compliant INR billing with EMI plan management",
        "GST invoice PDF generation (HSN 999293)",
        "eGCA logbook portal export (DGCA bulk-upload CSV format)",
        "Student self-service portal (logbook, schedule, document upload)",
        "Fleet utilisation analytics (hours per aircraft, instructor load, base throughput)",
        "DGCA SMS trend analysis + hazard register + risk matrix",
        "Multi-tenancy foundations for second FTO client onboarding",
      ],
      metric: "CFI pulls DGCA audit report with one click. Finance generates monthly GST return input without manual data entry.",
    },
  ];

  return (
    <div>
      <H2>MVP Phases</H2>
      <P>Four phases ensure operational value is delivered to Amravati by Month 3, with progressive complexity added as the team builds confidence. Each phase is independently deployable and immediately usable.</P>
      <div style={{ display: "grid", gap: 14 }}>
        {phases.map(ph => (
          <div key={ph.num} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ background: ph.color + "18", borderBottom: `1px solid ${ph.color}33`, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 800, color: ph.color, lineHeight: 1 }}>{ph.num}</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{ph.title}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{ph.duration} · {ph.focus}</div>
              </div>
            </div>
            <div style={{ padding: "14px 16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 16px", marginBottom: 12 }}>
                {ph.deliverables.map(d => (
                  <div key={d} style={{ fontSize: 12, color: C.sub, display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <span style={{ color: ph.color, flexShrink: 0, marginTop: 3 }}>›</span>
                    <span style={{ lineHeight: 1.55 }}>{d}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: C.surface, borderRadius: 4, padding: "9px 12px", display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: ph.color, whiteSpace: "nowrap" }}>✓ SUCCESS METRIC</span>
                <span style={{ fontSize: 12, color: C.sub, lineHeight: 1.6 }}>{ph.metric}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <InfoBox color={C.green + "44"}>
        <strong style={{ color: C.green }}>Recommended next design artifacts:</strong>
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          {[
            ["ERD / Database Schema", "Full PostgreSQL DDL — tables, constraints, indexes, and foreign keys ready for migrations"],
            ["OpenAPI Spec", "REST API contract for Phase 1 modules — allows parallel frontend and backend development"],
            ["UI Wireframes", "Dispatch Loop user journey screens — Roster → Briefing Packet → Tech Log Acceptance → Grading"],
            ["Architecture Diagram", "Infrastructure diagram: Docker services, network topology, data flows between all services"],
          ].map(([t, d]) => (
            <div key={t} style={{ display: "flex", gap: 8 }}>
              <span style={{ color: C.teal, fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>→ {t}</span>
              <span style={{ fontSize: 12, color: C.muted }}>{d}</span>
            </div>
          ))}
        </div>
      </InfoBox>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [active, setActive] = useState("overview");

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.amber, boxShadow: `0 0 6px ${C.amber}` }} />
        </div>
        <span style={{ fontFamily: "monospace", fontSize: 11, color: C.muted, letterSpacing: "0.08em" }}>
          AMRAVATI FTO MGMT PLATFORM · SOFTWARE REQUIREMENTS DOCUMENT
        </span>
        <span style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: 10, color: C.dim }}>SRD v1.0 · DRAFT</span>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <nav style={{ width: 206, background: C.surface, borderRight: `1px solid ${C.border}`, padding: "16px 0", flexShrink: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "2px 16px 12px", fontSize: 9, color: C.dim, fontFamily: "monospace", letterSpacing: "0.12em" }}>FLIGHT PLAN</div>
          {NAV.map((item, i) => (
            <button key={item.id} onClick={() => setActive(item.id)} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              padding: "9px 16px", background: active === item.id ? C.card : "transparent",
              border: "none", borderLeft: active === item.id ? `2px solid ${C.amber}` : `2px solid transparent`,
              color: active === item.id ? C.amber : C.muted,
              cursor: "pointer", textAlign: "left", fontSize: 12, transition: "all 0.1s",
            }}>
              <span style={{ fontFamily: "monospace", fontSize: 9, color: active === item.id ? C.amber : C.dim }}>
                {String(i + 1).padStart(2, "0")} ·
              </span>
              {item.label}
            </button>
          ))}

          {/* Separator */}
          <div style={{ margin: "16px 16px 12px", borderTop: `1px solid ${C.border}` }} />
          <div style={{ padding: "0 16px", fontSize: 9, color: C.dim, fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 8 }}>REQ LEGEND</div>
          {[["must", "Non-negotiable / Safety"], ["should", "MVP Required"], ["could", "Future Enhancement"]].map(([t, l]) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 16px" }}>
              <Badge type={t} />
              <span style={{ fontSize: 10, color: C.muted }}>{l}</span>
            </div>
          ))}
        </nav>

        {/* Main content */}
        <main style={{ flex: 1, padding: "24px 28px", overflowY: "auto" }}>
          {active === "overview" && <Overview />}
          {active === "stack"    && <Stack />}
          {active === "modules"  && <Modules />}
          {active === "data"     && <DataModels />}
          {active === "apis"     && <APIs />}
          {active === "nfr"      && <NFR />}
          {active === "mvp"      && <MVP />}
        </main>
      </div>
    </div>
  );
}
