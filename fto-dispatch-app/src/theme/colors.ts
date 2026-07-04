// Aviation instrument panel aesthetic:
// Dark cockpit background, amber instruments, green GO, red AOG.

export const C = {
  // ─── Backgrounds ────────────────────────────────────────────────
  bg: '#0B1017',          // Near-black: main app background
  bgCard: '#131D2A',      // Dark navy: card surface
  bgElevated: '#1B2A3D',  // Lighter navy: modals, elevated sheets
  bgInput: '#0F1923',     // Input fields

  // ─── Brand / Primary ────────────────────────────────────────────
  amber: '#F5A623',       // Instrument amber – primary action
  amberDim: '#C47A0D',    // Darker amber: pressed state
  amberGlow: '#F5A62322', // Amber glow: highlights

  // ─── Status ─────────────────────────────────────────────────────
  go: '#22C55E',          // Green: GO / Serviceable
  goMuted: '#16532B',     // Dark green: GO badge background
  aog: '#EF4444',         // Red: AOG / No-Go / Critical
  aogMuted: '#5A1A1A',    // Dark red: AOG badge background
  caution: '#EAB308',     // Yellow: Caution / Ferry blocked
  cautionMuted: '#473A05',// Dark yellow: Caution badge bg
  info: '#3B82F6',        // Blue: Informational
  infoMuted: '#1A2E5C',   // Dark blue: Info badge bg
  ferry: '#A855F7',       // Purple: Ferry status

  // ─── Text ───────────────────────────────────────────────────────
  textPrimary: '#E8EDF3', // Near-white: primary text
  textSecondary: '#7A8FA6', // Muted: secondary text / labels
  textMuted: '#4A5A6B',   // Very muted: placeholders
  textInverse: '#0B1017', // For use on amber backgrounds

  // ─── Borders / Dividers ─────────────────────────────────────────
  border: '#1E2D3D',      // Subtle border
  borderStrong: '#2D4057',// Stronger border / focused

  // ─── Overlays ───────────────────────────────────────────────────
  overlay: 'rgba(0,0,0,0.7)',
  scrim: 'rgba(11,16,23,0.95)',

  // ─── Flight type colours ────────────────────────────────────────
  flightDual: '#3B82F6',
  flightSolo: '#22C55E',
  flightCheck: '#F5A623',
  flightIfox: '#A855F7',
} as const;

export type ColorKey = keyof typeof C;

// Status → colour mappings
export const AIRCRAFT_STATUS_COLOR: Record<string, string> = {
  SERVICEABLE: C.go,
  AOG: C.aog,
  MAINTENANCE: C.caution,
  FERRY: C.ferry,
  UNKNOWN: C.textMuted,
};

export const FLIGHT_STATUS_COLOR: Record<string, string> = {
  SCHEDULED: C.info,
  DISPATCHED: C.amber,
  AIRBORNE: C.go,
  COMPLETE: C.textMuted,
  CANCELLED: C.aog,
  AOG: C.aog,
};

export const FLIGHT_TYPE_COLOR: Record<string, string> = {
  DUAL: C.flightDual,
  SOLO: C.flightSolo,
  CHECK: C.flightCheck,
  IFOX: C.flightIfox,
  LOCAL_SOLO: C.flightSolo,
};

export const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: C.aog,
  HIGH: C.caution,
  MEDIUM: C.info,
  LOW: C.textSecondary,
};
