#!/bin/bash
# smoke_test.sh — Quick API verification after docker compose up + migrate + seed_data
# Usage: bash smoke_test.sh
# Requires: curl, jq (install jq with: winget install jqlang.jq  or  choco install jq)

BASE="http://localhost:8000/api/v1"
PASS=0; FAIL=0

green(){ echo -e "\033[32m✓ $1\033[0m"; }
red(){   echo -e "\033[31m✗ $1\033[0m"; }
check(){
  local label="$1"; local expected="$2"; local actual="$3"
  if [ "$actual" = "$expected" ]; then
    green "$label"; ((PASS++))
  else
    red "$label (expected HTTP $expected, got $actual)"; ((FAIL++))
  fi
}

echo "=== FTO Backend Smoke Test ==="
echo "Target: $BASE"
echo ""

# ── 1. Health: Django admin accessible ────────────────────────────────────────
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/admin/)
check "Django admin reachable" "302" "$STATUS"

# ── 2. Swagger UI accessible ──────────────────────────────────────────────────
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/docs/)
check "Swagger UI reachable" "200" "$STATUS"

# ── 3. Auth: wrong password returns 401 ───────────────────────────────────────
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/token/" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fto.aero","password":"wrong"}')
check "Login with wrong password → 401" "401" "$STATUS"

# ── 4. Auth: get a valid token ────────────────────────────────────────────────
RESPONSE=$(curl -s -X POST "$BASE/auth/token/" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fto.aero","password":"Admin@1234"}')
TOKEN=$(echo "$RESPONSE" | grep -o '"access":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  red "Login failed — is seed_data done? Response: $RESPONSE"
  ((FAIL++))
else
  green "Login → received JWT access token"
  ((PASS++))
fi

# ── 5. Protected endpoint without token → 401 ─────────────────────────────────
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/infrastructure/aircraft/")
check "Unauthenticated request → 401" "401" "$STATUS"

# ── 6. GET /infrastructure/bases/ ─────────────────────────────────────────────
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/infrastructure/bases/" \
  -H "Authorization: Bearer $TOKEN")
check "GET /infrastructure/bases/ → 200" "200" "$STATUS"

COUNT=$(curl -s "$BASE/infrastructure/bases/" \
  -H "Authorization: Bearer $TOKEN" | grep -o '"icao_code"' | wc -l | tr -d ' ')
[ "$COUNT" -ge "3" ] && green "Bases seeded (found $COUNT)" && ((PASS++)) \
  || { red "Expected ≥3 bases, found $COUNT"; ((FAIL++)); }

# ── 7. GET /infrastructure/aircraft/ ──────────────────────────────────────────
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/infrastructure/aircraft/" \
  -H "Authorization: Bearer $TOKEN")
check "GET /infrastructure/aircraft/ → 200" "200" "$STATUS"

# ── 8. Fleet status endpoint ──────────────────────────────────────────────────
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE/infrastructure/aircraft/fleet-status/" \
  -H "Authorization: Bearer $TOKEN")
check "GET /aircraft/fleet-status/ → 200" "200" "$STATUS"

# ── 9. AOG endpoint ───────────────────────────────────────────────────────────
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE/infrastructure/aircraft/aog/" \
  -H "Authorization: Bearer $TOKEN")
check "GET /aircraft/aog/ → 200" "200" "$STATUS"

# ── 10. Check-constraints endpoint ────────────────────────────────────────────
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE/scheduling/flights/check-constraints/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"duration_minutes":60}')
check "POST /flights/check-constraints/ → 200" "200" "$STATUS"

# ── 11. Weather endpoint ──────────────────────────────────────────────────────
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE/weather/metar/latest/?icao=VAAM" \
  -H "Authorization: Bearer $TOKEN")
# 200 = cached data found, 202 = fetch queued (both valid)
[ "$STATUS" = "200" ] || [ "$STATUS" = "202" ] && \
  { green "GET /weather/metar/latest/?icao=VAAM → $STATUS"; ((PASS++)); } || \
  { red "GET /weather/metar/latest/ → unexpected $STATUS"; ((FAIL++)); }

# ── 12. Syllabus endpoint ─────────────────────────────────────────────────────
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE/syllabus/stages/" \
  -H "Authorization: Bearer $TOKEN")
check "GET /syllabus/stages/ → 200" "200" "$STATUS"

# ── 13. WebSocket connectivity (quick check) ──────────────────────────────────
WS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  --include \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  http://localhost:8000/ws/fleet/)
[ "$WS_STATUS" = "101" ] && \
  { green "WebSocket /ws/fleet/ → 101 Switching Protocols"; ((PASS++)); } || \
  { red "WebSocket /ws/fleet/ → $WS_STATUS (check Channels config)"; ((FAIL++)); }

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════"
echo "  PASSED: $PASS  |  FAILED: $FAIL"
echo "════════════════════════════════"
[ "$FAIL" -eq "0" ] && echo -e "\033[32m✅ All checks passed — backend is healthy!\033[0m" \
  || echo -e "\033[31m⚠  $FAIL check(s) failed — see above.\033[0m"
