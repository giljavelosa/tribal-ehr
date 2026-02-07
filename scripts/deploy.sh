#!/bin/bash
# Tribal EHR - Production Deployment Script
#
# This script handles a full production deployment:
#   1. Validates required environment variables
#   2. Builds Docker images for all services
#   3. Runs database migrations
#   4. Starts services with docker-compose
#   5. Waits for health checks to pass
#   6. Runs smoke tests to verify the deployment
#
# Usage:
#   ./scripts/deploy.sh                  # Deploy with defaults
#   ./scripts/deploy.sh --skip-build     # Skip Docker build step
#   ./scripts/deploy.sh --skip-migrate   # Skip database migrations
#   ./scripts/deploy.sh --dry-run        # Validate only, do not deploy

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"
ENV_FILE="${PROJECT_ROOT}/.env"

SKIP_BUILD=false
SKIP_MIGRATE=false
DRY_RUN=false
HEALTH_CHECK_TIMEOUT=120  # seconds
HEALTH_CHECK_INTERVAL=5   # seconds

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build)   SKIP_BUILD=true; shift ;;
    --skip-migrate) SKIP_MIGRATE=true; shift ;;
    --dry-run)      DRY_RUN=true; shift ;;
    --help|-h)
      echo "Usage: $0 [--skip-build] [--skip-migrate] [--dry-run]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ---------------------------------------------------------------------------
# Step 1: Validate environment variables
# ---------------------------------------------------------------------------

echo ""
echo "=========================================="
echo "  Tribal EHR - Production Deployment"
echo "=========================================="
echo ""

log_info "Step 1: Validating environment variables..."

REQUIRED_VARS=(
  "NODE_ENV"
  "DATABASE_URL"
  "POSTGRES_USER"
  "POSTGRES_PASSWORD"
  "POSTGRES_DB"
  "FHIR_SERVER_URL"
  "JWT_SECRET"
  "JWT_ISSUER"
  "SESSION_SECRET"
  "ENCRYPTION_KEY"
  "API_PORT"
  "FRONTEND_URL"
)

OPTIONAL_VARS=(
  "SMTP_HOST"
  "SMTP_PORT"
  "SMTP_USER"
  "SMTP_PASSWORD"
  "SENTRY_DSN"
  "LOG_LEVEL"
  "REDIS_URL"
  "CDS_HOOKS_ENABLED"
  "BULK_EXPORT_ENABLED"
)

# Load .env file if it exists
if [ -f "$ENV_FILE" ]; then
  log_info "Loading environment from $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  log_warn "No .env file found at $ENV_FILE; relying on exported environment variables."
fi

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    MISSING_VARS+=("$var")
  fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  log_error "Missing required environment variables:"
  for var in "${MISSING_VARS[@]}"; do
    echo "         - $var"
  done
  echo ""
  log_error "Copy .env.example to .env and fill in the values."
  exit 1
fi

log_ok "All required environment variables are set."

# Warn about missing optional vars
for var in "${OPTIONAL_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    log_warn "Optional variable $var is not set (using default)."
  fi
done

# Validate critical values
if [ "${NODE_ENV}" != "production" ] && [ "${NODE_ENV}" != "staging" ]; then
  log_warn "NODE_ENV is '${NODE_ENV}' (expected 'production' or 'staging')."
fi

if [ "${#JWT_SECRET}" -lt 32 ]; then
  log_error "JWT_SECRET must be at least 32 characters long."
  exit 1
fi

if [ "${#ENCRYPTION_KEY}" -lt 32 ]; then
  log_error "ENCRYPTION_KEY must be at least 32 characters long."
  exit 1
fi

echo ""

if [ "$DRY_RUN" = true ]; then
  log_info "Dry run mode - validation complete. Exiting."
  exit 0
fi

# ---------------------------------------------------------------------------
# Step 2: Build Docker images
# ---------------------------------------------------------------------------

if [ "$SKIP_BUILD" = true ]; then
  log_info "Step 2: Skipping Docker build (--skip-build flag)."
else
  log_info "Step 2: Building Docker images..."

  cd "$PROJECT_ROOT"

  docker compose -f "$COMPOSE_FILE" build --parallel 2>&1 | while IFS= read -r line; do
    echo "         $line"
  done

  if [ "${PIPESTATUS[0]}" -ne 0 ]; then
    log_error "Docker build failed."
    exit 1
  fi

  log_ok "Docker images built successfully."
fi

echo ""

# ---------------------------------------------------------------------------
# Step 3: Run database migrations
# ---------------------------------------------------------------------------

if [ "$SKIP_MIGRATE" = true ]; then
  log_info "Step 3: Skipping database migrations (--skip-migrate flag)."
else
  log_info "Step 3: Running database migrations..."

  # Ensure the database container is running
  docker compose -f "$COMPOSE_FILE" up -d postgres

  # Wait for postgres to be ready
  log_info "Waiting for PostgreSQL to accept connections..."
  RETRIES=30
  until docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" > /dev/null 2>&1; do
    RETRIES=$((RETRIES - 1))
    if [ "$RETRIES" -le 0 ]; then
      log_error "PostgreSQL did not become ready in time."
      exit 1
    fi
    sleep 2
  done
  log_ok "PostgreSQL is ready."

  # Run migrations via the API service
  docker compose -f "$COMPOSE_FILE" run --rm api npx prisma migrate deploy 2>&1 | while IFS= read -r line; do
    echo "         $line"
  done

  if [ "${PIPESTATUS[0]}" -ne 0 ]; then
    log_error "Database migration failed."
    exit 1
  fi

  log_ok "Database migrations applied successfully."
fi

echo ""

# ---------------------------------------------------------------------------
# Step 4: Start services
# ---------------------------------------------------------------------------

log_info "Step 4: Starting all services..."

docker compose -f "$COMPOSE_FILE" up -d

if [ $? -ne 0 ]; then
  log_error "Failed to start services."
  exit 1
fi

log_ok "All containers started."
echo ""

# List running containers
log_info "Running containers:"
docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || \
  docker compose -f "$COMPOSE_FILE" ps
echo ""

# ---------------------------------------------------------------------------
# Step 5: Wait for health checks
# ---------------------------------------------------------------------------

log_info "Step 5: Waiting for health checks (timeout: ${HEALTH_CHECK_TIMEOUT}s)..."

wait_for_health() {
  local name="$1"
  local url="$2"
  local elapsed=0

  echo -n "         Waiting for $name "
  while [ $elapsed -lt $HEALTH_CHECK_TIMEOUT ]; do
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    if [ "$status" = "200" ]; then
      echo " OK (${elapsed}s)"
      return 0
    fi
    echo -n "."
    sleep $HEALTH_CHECK_INTERVAL
    elapsed=$((elapsed + HEALTH_CHECK_INTERVAL))
  done

  echo " TIMEOUT"
  return 1
}

API_URL="http://localhost:${API_PORT:-3001}"
FHIR_URL="${FHIR_SERVER_URL:-http://localhost:8080/fhir}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

HEALTH_FAILURES=0

wait_for_health "API Server" "${API_URL}/health" || HEALTH_FAILURES=$((HEALTH_FAILURES + 1))
wait_for_health "FHIR Server" "${FHIR_URL}/metadata" || HEALTH_FAILURES=$((HEALTH_FAILURES + 1))
wait_for_health "Frontend" "http://localhost:${FRONTEND_PORT}" || HEALTH_FAILURES=$((HEALTH_FAILURES + 1))

echo ""

if [ $HEALTH_FAILURES -gt 0 ]; then
  log_error "$HEALTH_FAILURES service(s) failed health check."
  log_info "Check logs with: docker compose -f $COMPOSE_FILE logs"
  exit 1
fi

log_ok "All services are healthy."
echo ""

# ---------------------------------------------------------------------------
# Step 6: Run smoke tests
# ---------------------------------------------------------------------------

log_info "Step 6: Running smoke tests..."

SMOKE_PASS=0
SMOKE_FAIL=0

smoke_test() {
  local description="$1"
  local url="$2"
  local expected="$3"

  echo -n "         $description... "
  status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  if [ "$status" = "$expected" ]; then
    echo "PASS"
    SMOKE_PASS=$((SMOKE_PASS + 1))
  else
    echo "FAIL (HTTP $status, expected $expected)"
    SMOKE_FAIL=$((SMOKE_FAIL + 1))
  fi
}

# API smoke tests
smoke_test "API health endpoint" "${API_URL}/health" "200"
smoke_test "API requires auth for patients" "${API_URL}/api/v1/patients" "401"
smoke_test "API requires auth for encounters" "${API_URL}/api/v1/encounters" "401"

# FHIR smoke tests
smoke_test "FHIR CapabilityStatement" "${FHIR_URL}/metadata" "200"
smoke_test "FHIR Patient search" "${FHIR_URL}/Patient?_count=1" "200"
smoke_test "FHIR Observation search" "${FHIR_URL}/Observation?_count=1" "200"

# Frontend smoke tests
smoke_test "Frontend serves index page" "http://localhost:${FRONTEND_PORT}" "200"

# SMART configuration
smoke_test "SMART well-known endpoint" "${API_URL}/.well-known/smart-configuration" "200"

echo ""
log_info "Smoke test results: $SMOKE_PASS passed, $SMOKE_FAIL failed"

if [ $SMOKE_FAIL -gt 0 ]; then
  log_warn "Some smoke tests failed. The deployment may be incomplete."
  echo ""
  log_info "Useful commands:"
  echo "         docker compose -f $COMPOSE_FILE logs -f api"
  echo "         docker compose -f $COMPOSE_FILE logs -f fhir-server"
  echo "         docker compose -f $COMPOSE_FILE logs -f frontend"
  exit 1
fi

echo ""
echo "=========================================="
echo "  Deployment Complete"
echo "=========================================="
echo ""
echo "  Frontend:    http://localhost:${FRONTEND_PORT}"
echo "  API:         ${API_URL}"
echo "  FHIR Server: ${FHIR_URL}"
echo "  FHIR Docs:   ${FHIR_URL}/../swagger-ui/"
echo ""
echo "  Useful commands:"
echo "    View logs:    docker compose -f $COMPOSE_FILE logs -f"
echo "    Stop:         docker compose -f $COMPOSE_FILE down"
echo "    Seed data:    npx ts-node scripts/seed-data.ts"
echo "    Cert tests:   bash scripts/run-certification-tests.sh"
echo ""
