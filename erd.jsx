import { useState, useRef, useEffect, useCallback } from "react";

// ─── Palette ──────────────────────────────────────────────────────────────────
const D = {
  infrastructure: { color: "#F59E0B", bg: "#78350F22", label: "Infrastructure"  },
  users:          { color: "#3B82F6", bg: "#1E3A8A22", label: "Users & Auth"     },
  syllabus:       { color: "#A78BFA", bg: "#4C1D9522", label: "Syllabus"         },
  scheduling:     { color: "#22C55E", bg: "#14532D22", label: "Scheduling"       },
  dispatch:       { color: "#2DD4BF", bg: "#13404022", label: "Dispatch / Tech Log" },
  maintenance:    { color: "#EC4899", bg: "#83185122", label: "Maintenance (CAMO)"},
  compliance:     { color: "#EF4444", bg: "#7F1D1D22", label: "Safety & SMS"     },
  inventory:      { color: "#FB923C", bg: "#7C2D1222", label: "Inventory"        },
  finance:        { color: "#34D399", bg: "#06442022", label: "Finance"          },
  weather:        { color: "#38BDF8", bg: "#0C406022", label: "Weather / NOTAM"  },
  audit:          { color: "#94A3B8", bg: "#1E293B22", label: "Audit Log"        },
};

const C = {
  bg: "#060B14", canvas: "#060B14", border: "#152036",
  text: "#CBD5E1", sub: "#475569", dim: "#1E3A5F",
  pk: "#F59E0B", fk: "#60A5FA", uq: "#34D399", note: "#64748B",
  panel: "#0A1525",
};

// ─── Table definitions  [id, domain, x, y, columns] ─────────────────────────
// pk=true → PK,  fk="tableid" → FK,  uq=true → UNIQUE,  note="..." → suffix
const TW = 204, TH = 26, TR = 18;
const th = (cols) => TH + cols.length * TR + 5;

const TABLES = [
  // ── COL 0 (x=20)  INFRASTRUCTURE ──────────────────────────────────────────
  { id:"bases", d:"infrastructure", x:20, y:20, cols:[
    {n:"id",               pk:true},
    {n:"name",             nn:true},
    {n:"icao_code",        uq:true},
    {n:"base_type",        note:"enum"},
    {n:"ferry_buffer_hours", nn:true, note:"⚠ safety"},
    {n:"latitude / longitude", nn:true},
    {n:"elevation_ft"},
    {n:"is_active",        nn:true},
  ]},
  { id:"aircraft_types", d:"infrastructure", x:20, y:226, cols:[
    {n:"id",               pk:true},
    {n:"make_model",       nn:true},
    {n:"icao_designator"},
    {n:"max_crosswind_student_kt", nn:true},
    {n:"da_solo_warning_ft",       nn:true},
    {n:"interval_50 / 100 / 200hr", nn:true},
    {n:"interval_annual_months",   nn:true},
  ]},
  { id:"aircraft", d:"infrastructure", x:20, y:440, cols:[
    {n:"id",               pk:true},
    {n:"tail_number",      uq:true, nn:true},
    {n:"aircraft_type_id", fk:"aircraft_types", nn:true},
    {n:"home_base_id",     fk:"bases", nn:true},
    {n:"current_base_id",  fk:"bases", nn:true},
    {n:"status",           note:"enum ⚠"},
    {n:"hobbs_total",      nn:true, note:"→ triggers"},
    {n:"tacho_total",      nn:true},
    {n:"next_50hr_at / next_100hr_at"},
    {n:"next_annual_due"},
    {n:"aog_reason / aog_since"},
  ]},

  // ── COL 1 (x=245)  USERS ──────────────────────────────────────────────────
  { id:"users", d:"users", x:245, y:20, cols:[
    {n:"id",               pk:true},
    {n:"email",            uq:true, nn:true},
    {n:"phone",            uq:true},
    {n:"role",             note:"enum", nn:true},
    {n:"home_base_id",     fk:"bases"},
    {n:"is_active",        nn:true},
    {n:"token_version",    nn:true},
  ]},
  { id:"instructors", d:"users", x:245, y:214, cols:[
    {n:"id",                pk:true},
    {n:"user_id",           fk:"users", uq:true, nn:true},
    {n:"cfi_licence_number"},
    {n:"fdtl_daily_remaining_min",   nn:true, note:"⚠"},
    {n:"fdtl_weekly_remaining_min",  nn:true},
    {n:"fdtl_monthly_remaining_min", nn:true},
    {n:"type_rating_ids[]"},
  ]},
  { id:"students", d:"users", x:245, y:434, cols:[
    {n:"id",               pk:true},
    {n:"user_id",          fk:"users", uq:true, nn:true},
    {n:"spl_number / spl_expiry"},
    {n:"medical_class / medical_expiry", note:"⚠"},
    {n:"frtol_expiry"},
    {n:"hours_total / pic / dual",  note:"computed"},
    {n:"hours_xc / night / instr",  note:"computed"},
    {n:"solo_approved",    nn:true},
    {n:"solo_max_crosswind_kt", nn:true},
  ]},
  { id:"student_documents", d:"users", x:245, y:680, cols:[
    {n:"id",               pk:true},
    {n:"student_id",       fk:"students", nn:true},
    {n:"document_type",    note:"enum", nn:true},
    {n:"expiry_date"},
    {n:"file_path / file_hash"},
    {n:"is_superseded",    nn:true},
    {n:"uploaded_by",      fk:"users", nn:true},
  ]},

  // ── COL 2 (x=470)  SCHEDULING + DISPATCH ──────────────────────────────────
  { id:"flights", d:"scheduling", x:470, y:20, cols:[
    {n:"id",                pk:true},
    {n:"base_id",           fk:"bases", nn:true},
    {n:"student_id",        fk:"students"},
    {n:"instructor_id",     fk:"instructors", nn:true},
    {n:"aircraft_id",       fk:"aircraft", nn:true},
    {n:"flight_type",       note:"enum", nn:true},
    {n:"is_ferry",          nn:true},
    {n:"scheduled_start",   nn:true},
    {n:"scheduled_end",     nn:true},
    {n:"status",            note:"enum", nn:true},
    {n:"weather_snapshot_id", fk:"weather_cache"},
    {n:"created_by",        fk:"users", nn:true},
  ]},
  { id:"flight_exercises", d:"scheduling", x:470, y:320, cols:[
    {n:"id",               pk:true},
    {n:"flight_id",        fk:"flights", nn:true},
    {n:"exercise_id",      fk:"syllabus_exercises", nn:true},
    {n:"sequence_order",   nn:true},
  ]},
  { id:"instructor_duty_logs", d:"scheduling", x:470, y:424, cols:[
    {n:"id",               pk:true},
    {n:"instructor_id",    fk:"instructors", nn:true},
    {n:"flight_id",        fk:"flights"},
    {n:"duty_start",       nn:true},
    {n:"duty_end"},
    {n:"flight_minutes",   nn:true},
    {n:"base_id",          fk:"bases"},
  ]},
  { id:"tech_logs", d:"dispatch", x:470, y:578, cols:[
    {n:"id",                    pk:true},
    {n:"flight_id",             fk:"flights", uq:true, nn:true},
    {n:"aircraft_id",           fk:"aircraft", nn:true},
    {n:"hobbs_out / tacho_out"},
    {n:"hobbs_in  / tacho_in"},
    {n:"dispatch_cleared_by",   fk:"users"},
    {n:"accepted_by",           fk:"users"},
    {n:"density_altitude_ft"},
    {n:"crosswind_ok / ferry_buffer_ok", note:"⚠"},
    {n:"weather_snapshot_id",   fk:"weather_cache"},
    {n:"status",                note:"open/closed/aog"},
  ]},
  { id:"snag_entries", d:"dispatch", x:470, y:810, cols:[
    {n:"id",                   pk:true},
    {n:"tech_log_id",          fk:"tech_logs", nn:true},
    {n:"aircraft_id",          fk:"aircraft", nn:true},
    {n:"category",             note:"go/no_go ⚠", nn:true},
    {n:"description",          nn:true},
    {n:"triggers_aog",         note:"COMPUTED"},
    {n:"ata_chapter"},
    {n:"maintenance_record_id", fk:"maintenance_records"},
  ]},

  // ── COL 3 (x=695)  SYLLABUS + MAINTENANCE ─────────────────────────────────
  { id:"syllabus_stages", d:"syllabus", x:695, y:20, cols:[
    {n:"id",             pk:true},
    {n:"licence_type",   nn:true, note:"PPL/CPL"},
    {n:"stage_number",   nn:true},
    {n:"title",          nn:true},
  ]},
  { id:"syllabus_lessons", d:"syllabus", x:695, y:124, cols:[
    {n:"id",             pk:true},
    {n:"stage_id",       fk:"syllabus_stages", nn:true},
    {n:"lesson_number",  nn:true},
    {n:"title",          nn:true},
  ]},
  { id:"syllabus_exercises", d:"syllabus", x:695, y:228, cols:[
    {n:"id",                  pk:true},
    {n:"lesson_id",           fk:"syllabus_lessons", nn:true},
    {n:"exercise_code",       nn:true, note:"e.g. EX-4A"},
    {n:"title",               nn:true},
    {n:"flight_type_required", note:"enum"},
    {n:"prerequisite_ids[]",  note:"⚠ blocks scheduling"},
    {n:"pass_grade",          nn:true},
  ]},
  { id:"sortie_grades", d:"syllabus", x:695, y:406, cols:[
    {n:"id",           pk:true},
    {n:"flight_id",    fk:"flights", nn:true},
    {n:"exercise_id",  fk:"syllabus_exercises", nn:true},
    {n:"student_id",   fk:"students", nn:true},
    {n:"grade",        note:"1–5", nn:true},
    {n:"graded_by",    fk:"instructors", nn:true},
    {n:"locked_at",    note:"immutable after 7d"},
  ]},
  { id:"maintenance_records", d:"maintenance", x:695, y:556, cols:[
    {n:"id",                pk:true},
    {n:"aircraft_id",       fk:"aircraft", nn:true},
    {n:"base_id",           fk:"bases", nn:true},
    {n:"maintenance_type",  note:"enum", nn:true},
    {n:"performed_at_hours / date", nn:true},
    {n:"next_due_hours / date"},
    {n:"crs_issued",        note:"⚠ unlocks aircraft"},
    {n:"crs_issued_by",     fk:"users"},
    {n:"parts_replaced",    note:"JSONB"},
  ]},
  { id:"ad_sb_directives", d:"maintenance", x:695, y:764, cols:[
    {n:"id",                   pk:true},
    {n:"aircraft_id",          fk:"aircraft", nn:true},
    {n:"reference_number",     nn:true},
    {n:"directive_type",       note:"AD/SB/SL"},
    {n:"compliance_status",    note:"enum"},
    {n:"compliance_due_date"},
    {n:"complied_via_record_id", fk:"maintenance_records"},
  ]},

  // ── COL 4 (x=920)  WEATHER + INVENTORY + SMS + FINANCE ───────────────────
  { id:"weather_cache", d:"weather", x:920, y:20, cols:[
    {n:"id",                  pk:true},
    {n:"icao_code",           nn:true},
    {n:"metar_raw / taf_raw"},
    {n:"wind_speed_kt"},
    {n:"temp_celsius / qnh_hpa"},
    {n:"density_altitude_ft", note:"calculated ⚠"},
    {n:"fetched_at",          nn:true},
    {n:"is_stale",            note:"COMPUTED"},
  ]},
  { id:"notam_cache", d:"weather", x:920, y:220, cols:[
    {n:"id",            pk:true},
    {n:"icao_code",     nn:true},
    {n:"notam_id",      uq:true, nn:true},
    {n:"notam_text",    nn:true},
    {n:"effective_from / to"},
    {n:"is_active",     nn:true},
  ]},
  { id:"inventory_items", d:"inventory", x:920, y:370, cols:[
    {n:"id",               pk:true},
    {n:"base_id",          fk:"bases", nn:true},
    {n:"part_number",      nn:true},
    {n:"description",      nn:true},
    {n:"quantity_on_hand", nn:true},
    {n:"min_stock_level",  nn:true, note:"triggers req."},
    {n:"unit_cost_inr"},
  ]},
  { id:"inventory_requisitions", d:"inventory", x:920, y:526, cols:[
    {n:"id",                 pk:true},
    {n:"requesting_base_id", fk:"bases", nn:true},
    {n:"fulfilling_base_id", fk:"bases", nn:true},
    {n:"item_id",            fk:"inventory_items", nn:true},
    {n:"status",             note:"enum"},
    {n:"dispatch_flight_id", fk:"flights"},
    {n:"requested_by",       fk:"users", nn:true},
  ]},
  { id:"occurrence_reports", d:"compliance", x:920, y:700, cols:[
    {n:"id",              pk:true},
    {n:"report_number",   uq:true, nn:true},
    {n:"base_id",         fk:"bases", nn:true},
    {n:"aircraft_id",     fk:"aircraft"},
    {n:"occurrence_type", note:"enum", nn:true},
    {n:"severity",        note:"enum", nn:true},
    {n:"description",     nn:true},
    {n:"is_locked",       note:"COMPUTED ⚠"},
  ]},
  { id:"hazard_entries", d:"compliance", x:920, y:896, cols:[
    {n:"id",             pk:true},
    {n:"base_id",        fk:"bases"},
    {n:"title",          nn:true},
    {n:"likelihood",     note:"1–5", nn:true},
    {n:"severity",       note:"1–5", nn:true},
    {n:"risk_score",     note:"COMPUTED"},
    {n:"status",         note:"enum"},
  ]},
  { id:"billing_records", d:"finance", x:920, y:1066, cols:[
    {n:"id",              pk:true},
    {n:"student_id",      fk:"students", nn:true},
    {n:"amount_inr",      nn:true},
    {n:"gst_amount",      note:"COMPUTED"},
    {n:"total_amount_inr",note:"COMPUTED"},
    {n:"status",          note:"enum"},
    {n:"invoice_number",  uq:true},
    {n:"hsn_sac_code",    nn:true, note:"999293"},
  ]},

  // ── COL 5 (x=1145) AUDIT ──────────────────────────────────────────────────
  { id:"audit_log", d:"audit", x:1145, y:20, cols:[
    {n:"id",         pk:true, note:"BIGSERIAL"},
    {n:"table_name", nn:true},
    {n:"record_id",  nn:true},
    {n:"action",     note:"INSERT/UPDATE/DELETE"},
    {n:"changed_by", fk:"users"},
    {n:"changed_at", nn:true},
    {n:"old_values", note:"JSONB"},
    {n:"new_values", note:"JSONB"},
    {n:"ip_address"},
  ]},
  { id:"ame_duty_logs", d:"maintenance", x:1145, y:260, cols:[
    {n:"id",                    pk:true},
    {n:"ame_user_id",           fk:"users", nn:true},
    {n:"shift_start",           nn:true},
    {n:"shift_end"},
    {n:"base_id",               fk:"bases", nn:true},
    {n:"maintenance_record_id", fk:"maintenance_records"},
    {n:"total_hours"},
  ]},
  { id:"emi_plans", d:"finance", x:1145, y:460, cols:[
    {n:"id",                   pk:true},
    {n:"student_id",           fk:"students", nn:true},
    {n:"billing_record_id",    fk:"billing_records", nn:true},
    {n:"total_instalments",    nn:true},
    {n:"amount_per_instalment",nn:true},
    {n:"start_date",           nn:true},
  ]},
  { id:"emi_instalments", d:"finance", x:1145, y:620, cols:[
    {n:"id",               pk:true},
    {n:"emi_plan_id",      fk:"emi_plans", nn:true},
    {n:"instalment_number",nn:true},
    {n:"due_date",         nn:true},
    {n:"amount_inr",       nn:true},
    {n:"status",           note:"enum"},
    {n:"payment_reference"},
  ]},
];

// ─── FK Edges ────────────────────────────────────────────────────────────────
const EDGES = [
  // infrastructure
  {f:"aircraft",        t:"aircraft_types",     lbl:"aircraft_type_id"},
  {f:"aircraft",        t:"bases",              lbl:"home_base_id"},
  {f:"aircraft",        t:"bases",              lbl:"current_base_id"},
  // users
  {f:"users",           t:"bases",              lbl:"home_base_id"},
  {f:"instructors",     t:"users",              lbl:"user_id"},
  {f:"students",        t:"users",              lbl:"user_id"},
  {f:"student_documents",t:"students",          lbl:"student_id"},
  {f:"student_documents",t:"users",             lbl:"uploaded_by"},
  // scheduling
  {f:"flights",         t:"bases",              lbl:"base_id"},
  {f:"flights",         t:"students",           lbl:"student_id"},
  {f:"flights",         t:"instructors",        lbl:"instructor_id"},
  {f:"flights",         t:"aircraft",           lbl:"aircraft_id"},
  {f:"flights",         t:"weather_cache",      lbl:"weather_snapshot_id"},
  {f:"flights",         t:"users",              lbl:"created_by"},
  {f:"flight_exercises",t:"flights",            lbl:"flight_id"},
  {f:"flight_exercises",t:"syllabus_exercises", lbl:"exercise_id"},
  {f:"instructor_duty_logs",t:"instructors",    lbl:"instructor_id"},
  {f:"instructor_duty_logs",t:"flights",        lbl:"flight_id"},
  {f:"instructor_duty_logs",t:"bases",          lbl:"base_id"},
  // dispatch
  {f:"tech_logs",       t:"flights",            lbl:"flight_id"},
  {f:"tech_logs",       t:"aircraft",           lbl:"aircraft_id"},
  {f:"tech_logs",       t:"users",              lbl:"dispatch_cleared_by"},
  {f:"tech_logs",       t:"users",              lbl:"accepted_by"},
  {f:"tech_logs",       t:"weather_cache",      lbl:"weather_snapshot_id"},
  {f:"snag_entries",    t:"tech_logs",          lbl:"tech_log_id"},
  {f:"snag_entries",    t:"aircraft",           lbl:"aircraft_id"},
  {f:"snag_entries",    t:"maintenance_records",lbl:"maintenance_record_id"},
  // syllabus
  {f:"syllabus_lessons",    t:"syllabus_stages",    lbl:"stage_id"},
  {f:"syllabus_exercises",  t:"syllabus_lessons",   lbl:"lesson_id"},
  {f:"sortie_grades",       t:"flights",            lbl:"flight_id"},
  {f:"sortie_grades",       t:"syllabus_exercises", lbl:"exercise_id"},
  {f:"sortie_grades",       t:"students",           lbl:"student_id"},
  {f:"sortie_grades",       t:"instructors",        lbl:"graded_by"},
  // maintenance
  {f:"maintenance_records", t:"aircraft",           lbl:"aircraft_id"},
  {f:"maintenance_records", t:"bases",              lbl:"base_id"},
  {f:"maintenance_records", t:"users",              lbl:"crs_issued_by"},
  {f:"ad_sb_directives",    t:"aircraft",           lbl:"aircraft_id"},
  {f:"ad_sb_directives",    t:"maintenance_records",lbl:"complied_via_record_id"},
  {f:"ame_duty_logs",       t:"users",              lbl:"ame_user_id"},
  {f:"ame_duty_logs",       t:"bases",              lbl:"base_id"},
  {f:"ame_duty_logs",       t:"maintenance_records",lbl:"maintenance_record_id"},
  // inventory
  {f:"inventory_items",       t:"bases",             lbl:"base_id"},
  {f:"inventory_requisitions",t:"bases",             lbl:"requesting_base_id"},
  {f:"inventory_requisitions",t:"inventory_items",   lbl:"item_id"},
  {f:"inventory_requisitions",t:"flights",           lbl:"dispatch_flight_id"},
  {f:"inventory_requisitions",t:"users",             lbl:"requested_by"},
  // compliance
  {f:"occurrence_reports",t:"bases",       lbl:"base_id"},
  {f:"occurrence_reports",t:"aircraft",    lbl:"aircraft_id"},
  {f:"hazard_entries",    t:"bases",       lbl:"base_id"},
  // finance
  {f:"billing_records",  t:"students",          lbl:"student_id"},
  {f:"emi_plans",        t:"students",          lbl:"student_id"},
  {f:"emi_plans",        t:"billing_records",   lbl:"billing_record_id"},
  {f:"emi_instalments",  t:"emi_plans",         lbl:"emi_plan_id"},
  // audit
  {f:"audit_log",        t:"users",             lbl:"changed_by"},
];

// ─── SVG path between two tables ─────────────────────────────────────────────
function edgePath(src, tgt) {
  const sh = th(src.cols), thh = th(tgt.cols);
  const sMy = src.y + sh / 2, tMy = tgt.y + thh / 2;
  const sRx = src.x + TW,     tRx = tgt.x + TW;
  const sLx = src.x,          tLx = tgt.x;

  const sameCol = Math.abs(src.x - tgt.x) < 20;

  if (sameCol) {
    // same column — vertical arc between table tops/bottoms
    const fromY = src.y < tgt.y ? src.y + sh : src.y;
    const toY   = src.y < tgt.y ? tgt.y      : tgt.y + thh;
    const fx = src.x + TW * 0.5;
    const tx2 = tgt.x + TW * 0.5;
    const midY = (fromY + toY) / 2;
    return `M ${fx} ${fromY} C ${fx} ${midY} ${tx2} ${midY} ${tx2} ${toY}`;
  }

  if (tLx >= sRx - 5) {
    // forward (rightward) — standard bezier
    const gap = tLx - sRx;
    const c   = Math.max(gap * 0.45, 36);
    return `M ${sRx} ${sMy} C ${sRx + c} ${sMy} ${tLx - c} ${tMy} ${tLx} ${tMy}`;
  }

  // backward (leftward) — arc via left side routing
  // Route from source LEFT edge → arc left → arrive at target RIGHT edge
  const pivot = Math.min(sLx, tRx) - 32;
  return `M ${sLx} ${sMy} C ${pivot} ${sMy} ${pivot} ${tMy} ${tRx} ${tMy}`;
}

// ─── Arrowhead markers ────────────────────────────────────────────────────────
function Markers() {
  return (
    <defs>
      <marker id="a-dim" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">
        <path d="M0,0 L0,6 L6,3 z" fill="#1E3A5F" />
      </marker>
      {Object.entries(D).map(([key, { color }]) => (
        <marker key={key} id={`a-${key}`} markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill={color} />
        </marker>
      ))}
      <pattern id="dots" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="0.7" fill="#0F2035" />
      </pattern>
    </defs>
  );
}

// ─── Table SVG node ──────────────────────────────────────────────────────────
function TableNode({ table, isSelected, isConnected, dimmed, onSelect, onEnter, onLeave }) {
  const h     = th(table.cols);
  const color = D[table.d].color;
  const op    = dimmed ? 0.28 : 1;
  const bdr   = isSelected ? color : isConnected ? color + "88" : "#1A3050";
  const bw    = isSelected ? 2     : isConnected ? 1.5          : 0.8;

  return (
    <g
      style={{ cursor: "pointer", opacity: op }}
      onClick={onSelect}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {/* Drop shadow */}
      {(isSelected || isConnected) && (
        <rect x={table.x - 2} y={table.y - 2} width={TW + 4} height={h + 4}
          rx={6} fill={color + "18"} />
      )}
      {/* Body */}
      <rect x={table.x} y={table.y} width={TW} height={h} rx={4}
        fill="#0A1828" stroke={bdr} strokeWidth={bw} />
      {/* Header band */}
      <rect x={table.x} y={table.y} width={TW} height={TH} rx={4}
        fill={color + "28"} />
      <rect x={table.x} y={table.y + TH - 1} width={TW} height={1}
        fill={color + "55"} />
      {/* Header text */}
      <text x={table.x + 9} y={table.y + TH - 8}
        fontSize={11} fontWeight={700} fill={color} fontFamily="monospace"
        style={{ userSelect: "none" }}>
        {table.id}
      </text>
      {/* Columns */}
      {table.cols.map((col, ci) => {
        const cy  = table.y + TH + ci * TR + 3;
        const clr = col.pk ? C.pk : col.fk ? C.fk : col.uq ? C.uq : "#4A6080";
        return (
          <g key={`${col.n}-${ci}`}>
            {ci % 2 === 0 &&
              <rect x={table.x + 1} y={cy} width={TW - 2} height={TR}
                fill="#FFFFFF05" />}
            {/* Icon */}
            <text x={table.x + 7} y={cy + TR - 5}
              fontSize={8.5} fill={clr} fontFamily="monospace"
              style={{ userSelect: "none" }}>
              {col.pk ? "🔑" : col.fk ? "→ " : col.uq ? "★ " : "  "}
            </text>
            {/* Column name */}
            <text x={table.x + 20} y={cy + TR - 5}
              fontSize={9.5} fill={clr} fontFamily="monospace"
              style={{ userSelect: "none" }}>
              {col.n}
            </text>
            {/* Suffix note */}
            {col.note &&
              <text x={table.x + TW - 5} y={cy + TR - 5}
                fontSize={8} fill={col.note.includes("⚠") ? "#F59E0B66" : "#33506688"}
                fontFamily="monospace" textAnchor="end"
                style={{ userSelect: "none" }}>
                {col.note}
              </text>}
          </g>
        );
      })}
    </g>
  );
}

// ─── Info Sidebar ─────────────────────────────────────────────────────────────
function Sidebar({ table, tableMap, onClear }) {
  if (!table) return (
    <div style={{ padding: "18px 14px" }}>
      <div style={{ fontSize: 9, color: "#1E3A5F", fontFamily: "monospace",
        letterSpacing: "0.12em", marginBottom: 18 }}>
        ENTITY RELATIONSHIP DIAGRAM
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8", marginBottom: 16 }}>
        29 Tables · 55 FK Edges
      </div>
      <div style={{ fontSize: 10, color: "#334155", marginBottom: 20, lineHeight: 1.7 }}>
        Click any table to explore its foreign key connections.
        Scroll to zoom · Drag to pan.
      </div>
      <div style={{ borderTop: "1px solid #152036", paddingTop: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 9, color: "#1E3A5F", fontFamily: "monospace",
          letterSpacing: "0.1em", marginBottom: 10 }}>DOMAINS</div>
        {Object.entries(D).map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center",
            gap: 7, marginBottom: 7 }}>
            <div style={{ width: 9, height: 9, borderRadius: 2,
              background: v.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#475569" }}>{v.label}</span>
          </div>
        ))}
      </div>
      <div style={{ borderTop: "1px solid #152036", paddingTop: 14 }}>
        <div style={{ fontSize: 9, color: "#1E3A5F", fontFamily: "monospace",
          letterSpacing: "0.1em", marginBottom: 8 }}>LEGEND</div>
        {[["🔑", C.pk, "Primary Key"], ["→ ", C.fk, "Foreign Key"],
          ["★ ", C.uq, "Unique"], ["⚠", "#F59E0B", "Safety critical"]].map(([ic, cl, lb]) => (
          <div key={lb} style={{ display: "flex", alignItems: "center",
            gap: 6, marginBottom: 5 }}>
            <span style={{ fontFamily: "monospace", fontSize: 10, color: cl }}>{ic}</span>
            <span style={{ fontSize: 10, color: "#475569" }}>{lb}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const color      = D[table.d].color;
  const outEdges   = EDGES.filter(e => e.f === table.id);
  const inEdges    = EDGES.filter(e => e.t === table.id);
  const colCount   = table.cols.length;
  const pkCols     = table.cols.filter(c => c.pk);
  const fkCols     = table.cols.filter(c => c.fk);

  return (
    <div style={{ padding: "14px 14px", overflowY: "auto", height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start",
        justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 9, color: color + "AA", fontFamily: "monospace",
            letterSpacing: "0.1em", marginBottom: 4, textTransform: "uppercase" }}>
            {D[table.d].label}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "monospace" }}>
            {table.id}
          </div>
        </div>
        <button onClick={onClear} style={{ background: "none", border: "1px solid #152036",
          borderRadius: 4, color: "#334155", cursor: "pointer", padding: "2px 7px",
          fontSize: 11, lineHeight: 1.4, flexShrink: 0 }}>✕</button>
      </div>

      {/* Stats strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        gap: 6, marginBottom: 14 }}>
        {[["cols", colCount, "#64748B"], ["refs→", outEdges.length, "#60A5FA"],
          ["←refby", inEdges.length, "#22C55E"]].map(([l, v, c]) => (
          <div key={l} style={{ background: "#08111E", border: "1px solid #152036",
            borderRadius: 4, padding: "7px 4px", textAlign: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: c,
              fontFamily: "monospace", lineHeight: 1 }}>{v}</div>
            <div style={{ fontSize: 8, color: "#334155", marginTop: 3,
              textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Columns */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 9, color: "#1E3A5F", fontFamily: "monospace",
          letterSpacing: "0.1em", marginBottom: 7 }}>COLUMNS</div>
        <div style={{ background: "#08111E", border: "1px solid #152036",
          borderRadius: 4, overflow: "hidden" }}>
          {table.cols.map((col, i) => (
            <div key={`col-${i}`} style={{ padding: "5px 9px",
              borderBottom: i < table.cols.length - 1 ? "1px solid #0F1E30" : "none",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: i % 2 === 0 ? "#FFFFFF03" : "transparent" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 9, fontFamily: "monospace",
                  color: col.pk ? C.pk : col.fk ? C.fk : col.uq ? C.uq : "#334155" }}>
                  {col.pk ? "🔑" : col.fk ? "→" : col.uq ? "★" : "·"}
                </span>
                <span style={{ fontSize: 10, fontFamily: "monospace",
                  color: col.pk ? C.pk : col.fk ? C.fk : col.uq ? C.uq : "#4A6888" }}>
                  {col.n}
                </span>
              </div>
              {col.fk &&
                <span style={{ fontSize: 9, color: D[tableMap[col.fk]?.d]?.color || "#334155",
                  fontFamily: "monospace", flexShrink: 0 }}>↗ {col.fk}</span>}
              {col.note && !col.fk &&
                <span style={{ fontSize: 8, color: col.note.includes("⚠") ? "#F59E0B66" : "#283F55",
                  fontFamily: "monospace" }}>{col.note}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* References TO */}
      {outEdges.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, color: "#1E3A5F", fontFamily: "monospace",
            letterSpacing: "0.1em", marginBottom: 7 }}>→ REFERENCES (FK OUT)</div>
          {outEdges.map((e, i) => (
            <div key={i} style={{ fontSize: 10, color: "#3B5270", padding: "4px 0",
              borderBottom: "1px solid #0C1A28", display: "flex",
              justifyContent: "space-between" }}>
              <span style={{ color: "#405E7A", fontFamily: "monospace" }}>{e.lbl}</span>
              <span style={{ color: D[tableMap[e.t]?.d]?.color || "#60A5FA" }}>
                → {e.t}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Referenced BY */}
      {inEdges.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: "#1E3A5F", fontFamily: "monospace",
            letterSpacing: "0.1em", marginBottom: 7 }}>← REFERENCED BY</div>
          {inEdges.map((e, i) => (
            <div key={i} style={{ fontSize: 10, color: "#3B5270", padding: "4px 0",
              borderBottom: "1px solid #0C1A28", display: "flex",
              justifyContent: "space-between" }}>
              <span style={{ color: D[tableMap[e.f]?.d]?.color || "#60A5FA" }}>
                {e.f}
              </span>
              <span style={{ color: "#2A4055", fontFamily: "monospace" }}>
                .{e.lbl}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const tableMap = Object.fromEntries(TABLES.map(t => [t.id, t]));

  // Find overall canvas bounds
  const maxX = Math.max(...TABLES.map(t => t.x + TW)) + 30;
  const maxY = Math.max(...TABLES.map(t => t.y + th(t.cols))) + 30;

  const [sel, setSel]         = useState(null);
  const [hov, setHov]         = useState(null);
  const [vb, setVb]           = useState({ x: -10, y: -10, w: maxX, h: maxY });
  const svgRef                = useRef(null);
  const panRef                = useRef({ active: false, lx: 0, ly: 0 });

  const active = sel || hov;
  const connIds = useCallback((id) => {
    if (!id) return new Set();
    const s = new Set([id]);
    EDGES.forEach(e => { if (e.f === id) s.add(e.t); if (e.t === id) s.add(e.f); });
    return s;
  }, []);
  const activeIds = connIds(active);

  // Pan
  const onMD = (e) => {
    if (e.target.closest(".no-pan")) return;
    panRef.current = { active: true, lx: e.clientX, ly: e.clientY };
    e.preventDefault();
  };
  const onMM = useCallback((e) => {
    if (!panRef.current.active) return;
    const dx = e.clientX - panRef.current.lx;
    const dy = e.clientY - panRef.current.ly;
    const svgW = svgRef.current?.clientWidth  || 900;
    const svgH = svgRef.current?.clientHeight || 700;
    setVb(v => ({ ...v, x: v.x - dx * (v.w / svgW), y: v.y - dy * (v.h / svgH) }));
    panRef.current.lx = e.clientX;
    panRef.current.ly = e.clientY;
  }, []);
  const onMU = () => { panRef.current.active = false; };

  // Zoom (wheel)
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handler = (e) => {
      e.preventDefault();
      const f = e.deltaY > 0 ? 1.14 : 0.88;
      setVb(v => {
        const nw = Math.min(Math.max(v.w * f, 300), maxX * 2.5);
        const nh = Math.min(Math.max(v.h * f, 200), maxY * 2.5);
        return { ...v, w: nw, h: nh };
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [maxX, maxY]);

  const fitAll  = () => setVb({ x: -20, y: -20, w: maxX + 30, h: maxY + 30 });
  const zoomIn  = () => setVb(v => ({ ...v, w: v.w * 0.75, h: v.h * 0.75 }));
  const zoomOut = () => setVb(v => ({ ...v, w: v.w * 1.35, h: v.h * 1.35 }));

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg,
      fontFamily: "system-ui, -apple-system, sans-serif", overflow: "hidden" }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <div className="no-pan" style={{ width: 234, background: C.panel, flexShrink: 0,
        borderRight: "1px solid #101E30", overflowY: "auto" }}>
        <Sidebar
          table={sel ? tableMap[sel] : null}
          tableMap={tableMap}
          onClear={() => setSel(null)}
        />
      </div>

      {/* ── Canvas ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <svg
          ref={svgRef}
          width="100%" height="100%"
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          style={{ cursor: panRef.current?.active ? "grabbing" : "grab", display: "block" }}
          onMouseDown={onMD}
          onMouseMove={onMM}
          onMouseUp={onMU}
          onMouseLeave={onMU}
        >
          <Markers />
          <rect x={-9999} y={-9999} width={99999} height={99999} fill="url(#dots)" />

          {/* Domain background bands */}
          {Object.entries(D).map(([key, { color, bg }]) => {
            const domTables = TABLES.filter(t => t.d === key);
            if (!domTables.length) return null;
            const minX2 = Math.min(...domTables.map(t => t.x))      - 8;
            const minY2 = Math.min(...domTables.map(t => t.y))      - 8;
            const mxX   = Math.max(...domTables.map(t => t.x + TW)) + 8;
            const mxY   = Math.max(...domTables.map(t => t.y + th(t.cols))) + 8;
            const isAct = active ? domTables.some(t => activeIds.has(t.id)) : false;
            return (
              <rect key={key} x={minX2} y={minY2} width={mxX - minX2}
                height={mxY - minY2} rx={8}
                fill={isAct ? color + "14" : bg}
                stroke={color + (isAct ? "44" : "18")}
                strokeWidth={isAct ? 1.2 : 0.6}
              />
            );
          })}

          {/* Domain labels */}
          {Object.entries(D).map(([key, { color, label }]) => {
            const domTables = TABLES.filter(t => t.d === key);
            if (!domTables.length) return null;
            const minX2 = Math.min(...domTables.map(t => t.x)) - 5;
            const minY2 = Math.min(...domTables.map(t => t.y)) - 6;
            return (
              <text key={key} x={minX2 + 5} y={minY2 - 1}
                fontSize={8} fill={color + "66"} fontFamily="monospace"
                letterSpacing="0.08em" style={{ userSelect: "none" }}>
                {label.toUpperCase()}
              </text>
            );
          })}

          {/* ── FK edges ──────────────────────────────────────────────── */}
          {EDGES.map((edge, i) => {
            const src = tableMap[edge.f];
            const tgt = tableMap[edge.t];
            if (!src || !tgt) return null;
            const isSrcAct = active === edge.f;
            const isTgtAct = active === edge.t;
            const isActive = isSrcAct || isTgtAct;
            const domColor = D[src.d]?.color || "#334155";
            const pathStr  = edgePath(src, tgt);
            return (
              <path
                key={i}
                d={pathStr}
                fill="none"
                stroke={isActive ? domColor : "#162535"}
                strokeWidth={isActive ? 1.6 : 0.8}
                strokeDasharray={isTgtAct && !isSrcAct ? "4 3" : "none"}
                opacity={active ? (isActive ? 0.92 : 0.07) : 0.22}
                markerEnd={isActive ? `url(#a-${src.d})` : "url(#a-dim)"}
              />
            );
          })}

          {/* ── Table nodes ───────────────────────────────────────────── */}
          {TABLES.map(table => (
            <TableNode
              key={table.id}
              table={table}
              isSelected={sel === table.id}
              isConnected={active ? activeIds.has(table.id) : false}
              dimmed={active ? !activeIds.has(table.id) : false}
              onSelect={() => setSel(s => s === table.id ? null : table.id)}
              onEnter={() => setHov(table.id)}
              onLeave={() => setHov(null)}
            />
          ))}
        </svg>

        {/* Zoom controls */}
        <div className="no-pan" style={{ position: "absolute", bottom: 16, right: 16,
          display: "flex", flexDirection: "column", gap: 5 }}>
          {[["＋", zoomIn], ["－", zoomOut], ["⊡", fitAll]].map(([lbl, fn]) => (
            <button key={lbl} onClick={fn} style={{
              width: 32, height: 32, background: "#0A1525",
              border: "1px solid #152036", borderRadius: 6,
              color: "#64748B", cursor: "pointer", fontSize: lbl === "⊡" ? 14 : 20,
              lineHeight: 1, display: "flex", alignItems: "center",
              justifyContent: "center"
            }}>{lbl}</button>
          ))}
        </div>

        {/* Stats bar */}
        <div className="no-pan" style={{ position: "absolute", top: 12, right: 16,
          background: "#08111E", border: "1px solid #152036", borderRadius: 6,
          padding: "6px 12px", display: "flex", gap: 16 }}>
          {[["29", "tables"], ["55", "FK edges"], ["6", "triggers"]].map(([v, l]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#CBD5E1",
                fontFamily: "monospace", lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 8, color: "#1E3A5F", textTransform: "uppercase",
                letterSpacing: "0.06em", marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
