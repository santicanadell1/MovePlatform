#!/usr/bin/env bash
# MOVE Platform — K6 load tests (seed + run en un solo comando)
#
# Uso:
#   bash tests/k6/run-all.sh
#
# Variables de entorno opcionales:
#   K6_BOOKING_URL      http://localhost:3001
#   K6_OPERATIONS_URL   http://localhost:3002
#   K6_TRACKING_URL     http://localhost:3003
#   K6_PROMETHEUS_URL   http://localhost:9090/api/v1/write
#   REDIS_PASSWORD      redis_secret
#
# Requisitos:
#   - k6 instalado (https://k6.io/docs/get-started/installation)
#   - Stack Docker corriendo: docker compose up -d

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CREDS_FILE="${SCRIPT_DIR}/setup/k6-credentials.json"

BOOKING_URL="${K6_BOOKING_URL:-http://localhost:3001}"
OPERATIONS_URL="${K6_OPERATIONS_URL:-http://localhost:3002}"
TRACKING_URL="${K6_TRACKING_URL:-http://localhost:3003}"
REDIS_PASSWORD="${REDIS_PASSWORD:-redis_secret}"
PROMETHEUS_URL="${K6_PROMETHEUS_URL:-http://localhost:9090/api/v1/write}"

TOP_EMAIL="k6-top-1@test.move.uy"
TOP_PASS="K6TopPass123!"
COLD_EMAIL="k6-cold@test.move.uy"
COLD_PASS="K6ColdPass123!"

# ── Colores ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✓${NC} $*"; }
warn() { echo -e "  ${YELLOW}!${NC} $*"; }
die()  { echo -e "  ${RED}✗ $*${NC}"; exit 1; }

# ── 1. Verificar requisitos ──────────────────────────────────────────────────
echo "============================================"
echo " MOVE Platform — K6 Load Tests"
echo "============================================"
echo ""
echo "▶ Verificando requisitos..."

command -v k6 &>/dev/null || die "k6 no está instalado. Ver https://k6.io/docs/get-started/installation"
command -v curl &>/dev/null || die "curl no está instalado"
command -v docker &>/dev/null || die "docker no está instalado"

for container in move-booking move-postgres move-redis move-operations move-tracking; do
  STATUS=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || echo "missing")
  [[ "$STATUS" == "running" ]] || die "Contenedor $container no está corriendo. Ejecutar: docker compose up -d"
done
ok "Servicios Docker corriendo"

# ── 2. Obtener categoryId desde la BD ────────────────────────────────────────
echo ""
echo "▶ Obteniendo categoryId de la BD..."
CAT_ID=$(docker exec move-postgres psql -U move -d move_db -t -A \
  -c "SELECT id FROM booking.categories LIMIT 1;" 2>/dev/null || echo "")
[[ -n "$CAT_ID" ]] || die "No hay categorías en la BD. El booking-service necesita terminar su seed inicial."
ok "categoryId: $CAT_ID"

# ── 3. Registrar usuarios K6 (idempotente) ───────────────────────────────────
echo ""
echo "▶ Registrando usuarios K6..."

register_user() {
  local EMAIL=$1 PASS=$2 NAME=$3
  local STATUS
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BOOKING_URL/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"EMPRESA\",\"name\":\"$NAME\",\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"companyName\":\"$NAME SA\"}" 2>/dev/null)
  case "$STATUS" in
    201) ok "Creado: $EMAIL" ;;
    409) ok "Ya existe: $EMAIL" ;;
    *)   die "Register $EMAIL → HTTP $STATUS" ;;
  esac
}

register_user "$TOP_EMAIL" "$TOP_PASS" "K6 Top 1"
register_user "$COLD_EMAIL" "$COLD_PASS" "K6 Cold"

# ── 4. Login ─────────────────────────────────────────────────────────────────
echo ""
echo "▶ Obteniendo tokens..."

get_token() {
  local EMAIL=$1 PASS=$2
  local RESP TOKEN
  RESP=$(curl -s -X POST "$BOOKING_URL/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" 2>/dev/null)
  TOKEN=$(echo "$RESP" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  [[ -n "$TOKEN" ]] || die "Login $EMAIL falló: $RESP"
  echo "$TOKEN"
}

TOP_TOKEN=$(get_token "$TOP_EMAIL" "$TOP_PASS")
COLD_TOKEN=$(get_token "$COLD_EMAIL" "$COLD_PASS")
ok "Tokens obtenidos"

# ── 5. Crear CompanyProducts (idempotente) ────────────────────────────────────
echo ""
echo "▶ Creando CompanyProducts..."

ensure_product() {
  local TOKEN=$1
  local EXISTING RESP PROD_ID
  EXISTING=$(curl -s "$BOOKING_URL/v1/companies/products" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [[ -n "$EXISTING" ]]; then
    echo "$EXISTING"
    return
  fi
  RESP=$(curl -s -X POST "$BOOKING_URL/v1/companies/products" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"name\":\"Producto K6\",\"categoryId\":\"$CAT_ID\"}" 2>/dev/null)
  PROD_ID=$(echo "$RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  [[ -n "$PROD_ID" ]] || die "CompanyProduct creation falló: $RESP"
  echo "$PROD_ID"
}

TOP_PRODUCT_ID=$(ensure_product "$TOP_TOKEN")
COLD_PRODUCT_ID=$(ensure_product "$COLD_TOKEN")
ok "top productId: $TOP_PRODUCT_ID"
ok "cold productId: $COLD_PRODUCT_ID"

# ── 6. Warm Redis top-20 cache ───────────────────────────────────────────────
echo ""
echo "▶ Warming Redis cache top-20..."

TOP_USER_ID=$(docker exec move-postgres psql -U move -d move_db -t -A \
  -c "SELECT id FROM booking.users WHERE email='$TOP_EMAIL';" 2>/dev/null || echo "")

if [[ -n "$TOP_USER_ID" ]]; then
  # Queries separadas para evitar que whitespace en el nombre parta mal los campos
  PROD_ID=$(docker exec move-postgres psql -U move -d move_db -t -A \
    -c "SELECT id FROM booking.company_products WHERE client_id='$TOP_USER_ID' LIMIT 1;" \
    2>/dev/null | tr -d '[:space:]')
  PROD_CAT=$(docker exec move-postgres psql -U move -d move_db -t -A \
    -c "SELECT category_id FROM booking.company_products WHERE client_id='$TOP_USER_ID' LIMIT 1;" \
    2>/dev/null | tr -d '[:space:]')

  if [[ -n "$PROD_ID" && -n "$PROD_CAT" ]]; then
    NOW=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
    PRODUCT_JSON="[{\"id\":\"$PROD_ID\",\"clientId\":\"$TOP_USER_ID\",\"name\":\"Producto K6\",\"categoryId\":\"$PROD_CAT\",\"createdAt\":\"$NOW\",\"updatedAt\":\"$NOW\"}]"

    docker exec move-redis redis-cli -a "$REDIS_PASSWORD" --no-auth-warning \
      DEL "products:$TOP_USER_ID" "top20:clients" > /dev/null 2>&1
    docker exec move-redis redis-cli -a "$REDIS_PASSWORD" --no-auth-warning \
      SADD "top20:clients" "$TOP_USER_ID" > /dev/null 2>&1
    docker exec move-redis redis-cli -a "$REDIS_PASSWORD" --no-auth-warning \
      SET "products:$TOP_USER_ID" "$PRODUCT_JSON" EX 604800 > /dev/null 2>&1
    docker exec move-redis redis-cli -a "$REDIS_PASSWORD" --no-auth-warning \
      EXPIRE "top20:clients" 604800 > /dev/null 2>&1
    ok "Redis: userId $TOP_USER_ID → top20:clients + products cacheados"
  else
    warn "Producto no encontrado en BD — R1 top-20 puede superar 600ms"
  fi
else
  warn "Usuario top no encontrado en BD — R1 top-20 puede superar 600ms"
fi

# ── 7. Escribir k6-credentials.json ─────────────────────────────────────────
echo ""
echo "▶ Escribiendo credenciales..."
mkdir -p "$(dirname "$CREDS_FILE")"
cat > "$CREDS_FILE" << CREDSEOF
{
  "topUser":     { "email": "$TOP_EMAIL",  "password": "$TOP_PASS"  },
  "coldUser":    { "email": "$COLD_EMAIL", "password": "$COLD_PASS" },
  "topProductId":  "$TOP_PRODUCT_ID",
  "coldProductId": "$COLD_PRODUCT_ID"
}
CREDSEOF
ok "Credenciales escritas en $CREDS_FILE"

# ── 8. Correr escenarios K6 ──────────────────────────────────────────────────
# Intentar exportar a Prometheus; si falla (ext no disponible), correr sin output
K6_OUT=""
if k6 run --help 2>&1 | grep -q "experimental-prometheus-rw"; then
  K6_OUT="--out experimental-prometheus-rw=$PROMETHEUS_URL"
fi

echo ""
echo "============================================"
echo " Corriendo escenarios (URLs directas, sin gateway)"
echo "   Booking:    $BOOKING_URL"
echo "   Operations: $OPERATIONS_URL"
echo "   Tracking:   $TRACKING_URL"
echo "============================================"

run_scenario() {
  local LABEL=$1 FILE=$2
  echo ""
  echo "▶ $LABEL"
  K6_BOOKING_URL="$BOOKING_URL" \
  K6_OPERATIONS_URL="$OPERATIONS_URL" \
  K6_TRACKING_URL="$TRACKING_URL" \
  k6 run $K6_OUT "${SCRIPT_DIR}/scenarios/${FILE}"
}

run_scenario "R1 — Reserva empresa top-20 vs no-frecuente" "r1-reservas.js"
run_scenario "R2 — Consultas y listados bajo carga base"    "r2-consultas.js"
run_scenario "R3 — Pipeline GPS (50 conductores)"           "r3-gps.js"

echo ""
echo "============================================"
echo " ✓ Completado. Métricas: http://localhost:3000"
echo "============================================"
