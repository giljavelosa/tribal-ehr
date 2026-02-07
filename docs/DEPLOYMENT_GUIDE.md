# Tribal EHR -- Production Deployment Guide

**Version:** 1.0
**Last Updated:** 2026-02-05
**Classification:** Internal -- Operations Team

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Infrastructure Setup](#2-infrastructure-setup)
3. [Environment Variables](#3-environment-variables)
4. [Database Setup and Migration](#4-database-setup-and-migration)
5. [FHIR Server Configuration](#5-fhir-server-configuration)
6. [SSL/TLS Certificate Configuration](#6-ssltls-certificate-configuration)
7. [Production Docker Compose Overrides](#7-production-docker-compose-overrides)
8. [Monitoring and Alerting](#8-monitoring-and-alerting)
9. [Backup and Recovery](#9-backup-and-recovery)
10. [Scaling Considerations](#10-scaling-considerations)
11. [Security Hardening Checklist](#11-security-hardening-checklist)
12. [Maintenance Procedures](#12-maintenance-procedures)

---

## 1. Prerequisites

### Hardware Requirements

| Component | Minimum | Recommended | Notes |
|-----------|---------|-------------|-------|
| CPU | 4 cores | 8+ cores | HAPI FHIR and PostgreSQL benefit from additional cores |
| RAM | 16 GB | 32 GB | HAPI FHIR JVM: 4 GB, PostgreSQL: 8 GB, API: 2 GB, Redis: 512 MB |
| Storage (OS) | 50 GB SSD | 100 GB SSD | Operating system and application code |
| Storage (Data) | 100 GB SSD | 500 GB+ NVMe | PostgreSQL data, FHIR resources, audit logs |
| Storage (Backup) | 200 GB | 1 TB | Encrypted backups with 90-day retention |
| Network | 1 Gbps | 10 Gbps | Low-latency connections between services |

### Software Requirements

| Software | Version | Purpose |
|----------|---------|---------|
| Linux (Ubuntu/RHEL) | 22.04 LTS / 9.x | Host operating system |
| Docker Engine | >= 24.0 | Container runtime |
| Docker Compose | >= 2.20 | Service orchestration |
| Node.js | >= 20.0 (LTS) | Build tools (if building from source) |
| npm | >= 10.0 | Package management |
| OpenSSL | >= 3.0 | TLS certificate management |
| nginx (or equivalent) | >= 1.24 | Reverse proxy and TLS termination |
| certbot (optional) | >= 2.0 | Let's Encrypt certificate automation |

### Network Requirements

| Port | Protocol | Direction | Purpose |
|------|----------|-----------|---------|
| 443 | HTTPS | Inbound | Frontend and API access |
| 80 | HTTP | Inbound | ACME challenge (redirect to 443) |
| 22 | SSH | Inbound | Administrative access (restricted) |
| 2575 | TCP | Inbound | MLLP (HL7v2 messaging) |
| 25/587 | SMTP | Outbound | Direct messaging |
| 5432 | TCP | Internal only | PostgreSQL |
| 6379 | TCP | Internal only | Redis |
| 5672 | TCP | Internal only | RabbitMQ AMQP |
| 8080 | HTTP | Internal only | HAPI FHIR |
| 3001 | HTTP | Internal only | API server |
| 3000 | HTTP | Internal only | Frontend |

---

## 2. Infrastructure Setup

### 2.1 Docker Installation

```bash
# Ubuntu 22.04
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 2.2 Create Application User

```bash
# Create a dedicated service user
sudo useradd -m -s /bin/bash tribal-ehr
sudo usermod -aG docker tribal-ehr

# Create application directory
sudo mkdir -p /opt/tribal-ehr
sudo chown tribal-ehr:tribal-ehr /opt/tribal-ehr
```

### 2.3 Clone and Prepare

```bash
sudo -u tribal-ehr bash
cd /opt/tribal-ehr
git clone https://github.com/your-org/tribal-ehr.git .
```

### 2.4 Network Configuration

```bash
# Create the Docker network
docker network create --driver bridge tribal-ehr-network

# Verify firewall rules (UFW example)
sudo ufw allow 443/tcp
sudo ufw allow 80/tcp
sudo ufw allow 22/tcp
sudo ufw allow 2575/tcp   # MLLP (if needed)
sudo ufw enable
```

---

## 3. Environment Variables

Create a `.env` file in the project root. **This file contains secrets and must never be committed to version control.**

```bash
cp .env.example .env
chmod 600 .env
```

### Complete Environment Variable Reference

#### Database (PostgreSQL)

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `POSTGRES_PASSWORD` | PostgreSQL admin password | `$(openssl rand -base64 32)` | Yes |
| `POSTGRES_DB` | Database name | `tribal_ehr` | Yes |
| `POSTGRES_USER` | Database admin username | `ehr_admin` | Yes |
| `DATABASE_URL` | Full connection string (constructed by API) | `postgresql://ehr_admin:password@postgres:5432/tribal_ehr` | Yes |

#### Redis

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `REDIS_PASSWORD` | Redis authentication password | `$(openssl rand -base64 32)` | Yes |
| `REDIS_URL` | Full Redis connection string | `redis://:password@redis:6379` | Yes |
| `REDIS_MAX_MEMORY` | Maximum memory allocation | `512mb` | Optional (default: 256mb) |

#### RabbitMQ

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `RABBITMQ_USER` | RabbitMQ admin username | `ehr_rabbit` | Yes |
| `RABBITMQ_PASSWORD` | RabbitMQ admin password | `$(openssl rand -base64 32)` | Yes |
| `RABBITMQ_URL` | Full AMQP connection string | `amqp://user:pass@rabbitmq:5672/tribal_ehr` | Yes |

#### API Server

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Runtime environment | `production` | Yes |
| `PORT` | API server port | `3001` | Yes |
| `FHIR_SERVER_URL` | Internal HAPI FHIR URL | `http://hapi-fhir:8080/fhir` | Yes |
| `JWT_SECRET` | JWT signing secret (RS256 private key path or HMAC secret) | Path to PEM file or 64-char hex string | Yes |
| `JWT_ISSUER` | JWT issuer claim | `https://ehr.yourdomain.com` | Yes |
| `JWT_AUDIENCE` | JWT audience claim | `https://ehr.yourdomain.com` | Yes |
| `ENCRYPTION_KEY` | AES-256-GCM encryption key (64 hex characters = 256 bits) | `$(openssl rand -hex 32)` | Yes |
| `SESSION_TIMEOUT_MINUTES` | Session inactivity timeout | `15` | Optional (default: 15) |
| `CORS_ORIGIN` | Allowed CORS origins | `https://ehr.yourdomain.com` | Yes |
| `LOG_LEVEL` | Application log level | `info` | Optional (default: info) |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in milliseconds | `60000` | Optional (default: 60000) |
| `RATE_LIMIT_MAX_REQUESTS` | Maximum requests per window | `100` | Optional (default: 100) |

#### Frontend

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `VITE_API_URL` | Public API URL | `https://api.yourdomain.com` | Yes |
| `VITE_FHIR_URL` | Public FHIR URL | `https://fhir.yourdomain.com/fhir` | Yes |
| `VITE_APP_TITLE` | Application title | `Tribal EHR` | Optional |

#### FHIR Server

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `HAPI_FHIR_VERSION` | FHIR version | `R4` | Yes |
| `HAPI_FHIR_VALIDATION` | Enable request validation | `true` | Optional (default: true) |
| `HAPI_FHIR_BULK_EXPORT` | Enable Bulk Data Export | `true` | Optional (default: true) |

#### TLS / SSL

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `SSL_CERT_PATH` | Path to SSL certificate | `/etc/ssl/certs/tribal-ehr.crt` | Yes (production) |
| `SSL_KEY_PATH` | Path to SSL private key | `/etc/ssl/private/tribal-ehr.key` | Yes (production) |
| `SSL_CA_BUNDLE_PATH` | Path to CA certificate bundle | `/etc/ssl/certs/ca-bundle.crt` | Optional |

#### External Integrations

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `DIRECT_DOMAIN` | Direct messaging domain | `direct.yourdomain.com` | Optional |
| `DIRECT_CERT_PATH` | Direct protocol certificate | `/etc/ssl/direct/cert.pem` | Optional |
| `IIS_ENDPOINT` | Immunization registry endpoint | `mllp://iis.state.gov:2575` | Optional |
| `SYNDROMIC_ENDPOINT` | Syndromic surveillance endpoint | `mllp://ph.state.gov:2575` | Optional |

#### Monitoring

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `PROMETHEUS_ENABLED` | Enable Prometheus metrics | `true` | Optional |
| `PROMETHEUS_PORT` | Metrics endpoint port | `9090` | Optional |
| `ALERT_WEBHOOK_URL` | Webhook for critical alerts | `https://hooks.slack.com/services/...` | Optional |
| `ALERT_EMAIL` | Email for critical alerts | `ops@yourdomain.com` | Optional |

### Generate Secrets

```bash
# Generate all required secrets
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)" >> .env
echo "REDIS_PASSWORD=$(openssl rand -base64 32)" >> .env
echo "RABBITMQ_PASSWORD=$(openssl rand -base64 32)" >> .env
echo "JWT_SECRET=$(openssl rand -hex 64)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env
```

---

## 4. Database Setup and Migration

### 4.1 Initial Database Setup

The PostgreSQL container automatically initializes the database using the init script at `packages/api/src/db/init/01_init.sql`. This runs only on first startup when the data volume is empty.

```bash
# Start PostgreSQL
docker compose up -d postgres

# Wait for health check to pass
docker compose exec postgres pg_isready -U ehr_admin -d tribal_ehr
```

### 4.2 Run Migrations

```bash
# Run all pending migrations
docker compose exec api npm run db:migrate

# Verify migration status
docker compose exec api npm run db:migrate:status
```

### 4.3 Database Security

```bash
# Connect to PostgreSQL and configure security
docker compose exec postgres psql -U ehr_admin -d tribal_ehr

-- Enable row-level security on audit_events (prevent modification)
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_insert_only ON audit_events FOR INSERT TO ehr_admin WITH CHECK (true);
CREATE POLICY audit_select_only ON audit_events FOR SELECT TO ehr_admin USING (true);
-- No UPDATE or DELETE policies = no modification allowed

-- Enable pgcrypto for encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enable uuid-ossp for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\q
```

### 4.4 Database Performance Tuning

Edit `postgresql.conf` or add these to docker-compose environment:

```yaml
environment:
  POSTGRES_SHARED_BUFFERS: "8GB"           # 25% of total RAM
  POSTGRES_EFFECTIVE_CACHE_SIZE: "24GB"    # 75% of total RAM
  POSTGRES_WORK_MEM: "256MB"
  POSTGRES_MAINTENANCE_WORK_MEM: "2GB"
  POSTGRES_WAL_BUFFERS: "64MB"
  POSTGRES_MAX_CONNECTIONS: "200"
  POSTGRES_RANDOM_PAGE_COST: "1.1"         # SSD storage
  POSTGRES_EFFECTIVE_IO_CONCURRENCY: "200" # SSD storage
```

---

## 5. FHIR Server Configuration

### 5.1 HAPI FHIR Production Settings

The HAPI FHIR server is configured via `packages/fhir-server/application.yaml` and environment variables in docker-compose:

```yaml
# Production overrides for HAPI FHIR
spring:
  datasource:
    url: jdbc:postgresql://postgres:5432/tribal_ehr
    username: ehr_admin
    password: ${POSTGRES_PASSWORD}
    hikari:
      maximum-pool-size: 50
      minimum-idle: 10
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000

hapi:
  fhir:
    fhir_version: R4
    allow_multiple_delete: false          # Disable in production
    allow_external_references: true
    cors:
      allow_Credentials: true
      allowed_origin: "https://ehr.yourdomain.com"
    bulk_export_enabled: true
    validation:
      requests_enabled: true
    implementationguides:
      uscore:
        name: hl7.fhir.us.core
        version: 6.1.0
        url: "https://packages.simplifier.net/hl7.fhir.us.core/6.1.0"
```

### 5.2 JVM Configuration

```yaml
# In docker-compose.prod.yml
hapi-fhir:
  environment:
    JAVA_OPTS: >
      -Xms2g
      -Xmx4g
      -XX:+UseG1GC
      -XX:MaxGCPauseMillis=200
      -XX:+HeapDumpOnOutOfMemoryError
      -XX:HeapDumpPath=/tmp/heapdump.hprof
```

---

## 6. SSL/TLS Certificate Configuration

### 6.1 Certificate Acquisition

**Option A: Let's Encrypt (recommended for standard deployments)**

```bash
# Install certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot certonly --standalone -d ehr.yourdomain.com -d api.yourdomain.com -d fhir.yourdomain.com

# Certificates stored at:
# /etc/letsencrypt/live/ehr.yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/ehr.yourdomain.com/privkey.pem
```

**Option B: Organization-issued certificate**

Place your certificate files:
```bash
sudo mkdir -p /etc/ssl/tribal-ehr
sudo cp your-cert.crt /etc/ssl/tribal-ehr/tribal-ehr.crt
sudo cp your-key.key /etc/ssl/tribal-ehr/tribal-ehr.key
sudo cp ca-bundle.crt /etc/ssl/tribal-ehr/ca-bundle.crt
sudo chmod 600 /etc/ssl/tribal-ehr/tribal-ehr.key
```

### 6.2 Nginx Reverse Proxy Configuration

```nginx
# /etc/nginx/sites-available/tribal-ehr

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name ehr.yourdomain.com api.yourdomain.com;
    return 301 https://$host$request_uri;
}

# Frontend
server {
    listen 443 ssl http2;
    server_name ehr.yourdomain.com;

    ssl_certificate /etc/ssl/tribal-ehr/tribal-ehr.crt;
    ssl_certificate_key /etc/ssl/tribal-ehr/tribal-ehr.key;
    ssl_trusted_certificate /etc/ssl/tribal-ehr/ca-bundle.crt;

    # TLS configuration (FIPS 140-2 compatible)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.yourdomain.com" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# API and FHIR
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/ssl/tribal-ehr/tribal-ehr.crt;
    ssl_certificate_key /etc/ssl/tribal-ehr/tribal-ehr.key;
    ssl_trusted_certificate /etc/ssl/tribal-ehr/ca-bundle.crt;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Cache-Control "no-store, no-cache, must-revalidate" always;

    # API routes
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Request size limit (for C-CDA uploads)
        client_max_body_size 50M;
    }

    # FHIR endpoints (proxied through API)
    location /fhir/ {
        proxy_pass http://localhost:3001/fhir/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Bulk data export can produce large responses
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # SMART configuration
    location /.well-known/smart-configuration {
        proxy_pass http://localhost:3001/.well-known/smart-configuration;
        proxy_set_header Host $host;
    }

    # OAuth endpoints
    location /oauth/ {
        proxy_pass http://localhost:3001/oauth/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check (no auth required)
    location /health {
        proxy_pass http://localhost:3001/health;
    }
}
```

### 6.3 Certificate Renewal

```bash
# Set up automatic renewal (Let's Encrypt)
sudo crontab -e
# Add: 0 3 * * * certbot renew --quiet --post-hook "systemctl reload nginx"

# Manual renewal
sudo certbot renew
sudo systemctl reload nginx
```

---

## 7. Production Docker Compose Overrides

Create `docker-compose.prod.yml` to override development settings:

```yaml
version: '3.9'

services:
  postgres:
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_INITDB_ARGS: "--auth-host=scram-sha-256 --data-checksums"
    volumes:
      - /data/tribal-ehr/postgres:/var/lib/postgresql/data
    deploy:
      resources:
        limits:
          memory: 8G
          cpus: '4.0'
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "5"

  redis:
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD}
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
      --appendonly yes
      --appendfsync everysec
    volumes:
      - /data/tribal-ehr/redis:/data
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'

  rabbitmq:
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
    volumes:
      - /data/tribal-ehr/rabbitmq:/var/lib/rabbitmq
    ports:
      - "127.0.0.1:5672:5672"
      - "127.0.0.1:15672:15672"  # Management UI on loopback only
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'

  hapi-fhir:
    environment:
      spring.datasource.password: ${POSTGRES_PASSWORD}
      JAVA_OPTS: "-Xms2g -Xmx4g -XX:+UseG1GC -XX:MaxGCPauseMillis=200"
      hapi.fhir.allow_multiple_delete: "false"
      hapi.fhir.cors.allowed_origin: "https://ehr.yourdomain.com"
    ports:
      - "127.0.0.1:8080:8080"  # Loopback only
    deploy:
      resources:
        limits:
          memory: 6G
          cpus: '4.0'

  api:
    environment:
      NODE_ENV: production
      CORS_ORIGIN: "https://ehr.yourdomain.com"
      DATABASE_URL: "postgresql://ehr_admin:${POSTGRES_PASSWORD}@postgres:5432/tribal_ehr?ssl=false"
      JWT_SECRET: ${JWT_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      SESSION_TIMEOUT_MINUTES: "15"
      LOG_LEVEL: "info"
    ports:
      - "127.0.0.1:3001:3001"  # Loopback only (behind nginx)
    volumes: []  # Remove source code mounts in production
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '2.0'

  frontend:
    environment:
      VITE_API_URL: "https://api.yourdomain.com"
      VITE_FHIR_URL: "https://api.yourdomain.com/fhir"
    ports:
      - "127.0.0.1:3000:3000"  # Loopback only (behind nginx)
    volumes: []  # Remove source code mounts in production
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'
```

**Start production stack:**

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 8. Monitoring and Alerting

### 8.1 Health Checks

All services expose health check endpoints. Create a monitoring script:

```bash
#!/bin/bash
# /opt/tribal-ehr/scripts/health-check.sh

check_service() {
    local name=$1
    local url=$2
    local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url")
    if [ "$response" != "200" ]; then
        echo "CRITICAL: $name is DOWN (HTTP $response)"
        # Send alert
        curl -X POST "${ALERT_WEBHOOK_URL}" -H 'Content-Type: application/json' \
            -d "{\"text\": \"CRITICAL: Tribal EHR - $name is DOWN (HTTP $response)\"}"
        return 1
    fi
    echo "OK: $name is healthy"
    return 0
}

check_service "API" "http://localhost:3001/health"
check_service "Frontend" "http://localhost:3000"
check_service "FHIR Server" "http://localhost:8080/fhir/metadata"
```

Add to cron:

```bash
*/5 * * * * /opt/tribal-ehr/scripts/health-check.sh >> /var/log/tribal-ehr/health-check.log 2>&1
```

### 8.2 Log Aggregation

Configure centralized logging:

```yaml
# In docker-compose.prod.yml, for each service:
logging:
  driver: "json-file"
  options:
    max-size: "100m"
    max-file: "10"
    tag: "tribal-ehr/{{.Name}}"
```

**Log locations:**

| Service | Log Path | Content |
|---------|----------|---------|
| API | Container stdout/stderr | Application logs, request logs |
| FHIR | Container stdout/stderr | FHIR operations, validation errors |
| PostgreSQL | Container stdout/stderr | Query logs, connection events |
| nginx | `/var/log/nginx/access.log` | HTTP access logs |
| nginx | `/var/log/nginx/error.log` | HTTP error logs |
| Audit | Database `audit_events` table | PHI access audit trail |

### 8.3 Metrics

Monitor key metrics:

| Metric | Source | Threshold |
|--------|--------|-----------|
| API response time (p95) | API logs | < 500ms |
| API error rate (5xx) | API logs | < 1% |
| Database connections | PostgreSQL | < 80% of max |
| Database disk usage | PostgreSQL | < 80% capacity |
| Redis memory usage | Redis INFO | < 80% maxmemory |
| RabbitMQ queue depth | RabbitMQ API | < 1000 messages |
| FHIR server heap usage | JMX / actuator | < 80% max heap |
| Certificate expiry | Certificate check | > 30 days |
| Disk space | OS | > 20% free |

### 8.4 Alerting Rules

| Condition | Severity | Action |
|-----------|----------|--------|
| Any service health check fails | Critical | Page on-call, auto-restart container |
| API error rate > 5% for 5 minutes | Critical | Page on-call |
| Database disk > 90% | Critical | Page on-call |
| API p95 latency > 2s for 10 minutes | Warning | Notify team channel |
| Certificate expires in < 14 days | Warning | Notify team channel |
| Failed login attempts > 10/minute | Warning | Notify security team |
| Audit chain integrity check fails | Critical | Page on-call + security team |

---

## 9. Backup and Recovery

### 9.1 Database Backup

```bash
#!/bin/bash
# /opt/tribal-ehr/scripts/backup-database.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/data/backups/tribal-ehr"
BACKUP_FILE="${BACKUP_DIR}/tribal_ehr_${TIMESTAMP}.sql.gz.enc"

mkdir -p "${BACKUP_DIR}"

# Dump and encrypt
docker compose exec -T postgres pg_dump -U ehr_admin -d tribal_ehr --format=custom | \
    gzip | \
    openssl enc -aes-256-cbc -salt -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY \
    -out "${BACKUP_FILE}"

# Verify backup
if [ $? -eq 0 ] && [ -s "${BACKUP_FILE}" ]; then
    echo "Backup successful: ${BACKUP_FILE} ($(du -h ${BACKUP_FILE} | cut -f1))"

    # Upload to off-site storage (example: S3)
    # aws s3 cp "${BACKUP_FILE}" "s3://tribal-ehr-backups/database/${TIMESTAMP}/"

    # Retain last 90 days of local backups
    find "${BACKUP_DIR}" -name "tribal_ehr_*.sql.gz.enc" -mtime +90 -delete
else
    echo "BACKUP FAILED"
    # Send alert
    curl -X POST "${ALERT_WEBHOOK_URL}" -H 'Content-Type: application/json' \
        -d '{"text": "CRITICAL: Tribal EHR database backup FAILED"}'
    exit 1
fi
```

Schedule daily backups:

```bash
# Crontab
0 2 * * * /opt/tribal-ehr/scripts/backup-database.sh >> /var/log/tribal-ehr/backup.log 2>&1
```

### 9.2 Database Recovery

```bash
#!/bin/bash
# /opt/tribal-ehr/scripts/restore-database.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: restore-database.sh <backup-file>"
    exit 1
fi

echo "WARNING: This will overwrite the current database."
echo "Press Ctrl+C to abort, or wait 10 seconds to continue..."
sleep 10

# Stop API to prevent writes
docker compose stop api frontend

# Decrypt and restore
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY -in "${BACKUP_FILE}" | \
    gunzip | \
    docker compose exec -T postgres pg_restore -U ehr_admin -d tribal_ehr --clean --if-exists

# Restart services
docker compose up -d api frontend

echo "Restore complete. Verify application functionality."
```

### 9.3 FHIR Server Data Backup

FHIR data is stored in the same PostgreSQL database and is included in the database backup. For FHIR-specific export:

```bash
# Bulk export all FHIR data
curl -X GET "http://localhost:8080/fhir/\$export" \
    -H "Accept: application/fhir+json" \
    -H "Prefer: respond-async"
```

### 9.4 Backup Verification

Test backup restoration monthly on a separate environment:

```bash
# Monthly backup verification procedure
# 1. Spin up a test PostgreSQL instance
# 2. Restore the latest backup
# 3. Run a subset of integration tests against the restored database
# 4. Verify record counts match production
# 5. Document results
```

---

## 10. Scaling Considerations

### 10.1 Vertical Scaling

| Component | Scaling Lever | Impact |
|-----------|---------------|--------|
| PostgreSQL | RAM, CPU cores | More concurrent queries, larger cache |
| HAPI FHIR | JVM heap (-Xmx) | More FHIR resources in memory |
| API | CPU cores, RAM | More concurrent API requests |
| Redis | RAM | More cached sessions/data |

### 10.2 Horizontal Scaling

| Component | Horizontal Strategy | Notes |
|-----------|---------------------|-------|
| API Server | Multiple container instances behind load balancer | Stateless; session state in Redis |
| Frontend | Multiple container instances behind load balancer | Stateless; static assets |
| PostgreSQL | Read replicas for read-heavy queries | Write to primary, read from replicas |
| Redis | Redis Sentinel or Redis Cluster | High availability and data partitioning |
| RabbitMQ | RabbitMQ Cluster with mirrored queues | Message durability and throughput |
| HAPI FHIR | Multiple instances with shared PostgreSQL | Stateless JPA server |

### 10.3 Load Balancing

```nginx
# Upstream configuration for API scaling
upstream tribal_ehr_api {
    least_conn;
    server api-1:3001;
    server api-2:3001;
    server api-3:3001;
}
```

---

## 11. Security Hardening Checklist

Complete the following checklist before go-live:

### Infrastructure

- [ ] All default passwords changed (PostgreSQL, Redis, RabbitMQ)
- [ ] `.env` file permissions set to 600 (owner read/write only)
- [ ] Docker socket not exposed to containers
- [ ] Containers run as non-root users
- [ ] Docker image versions pinned (no `latest` tags in production)
- [ ] Host firewall configured (only necessary ports open)
- [ ] SSH key-based authentication only (password auth disabled)
- [ ] Automatic security updates enabled on host OS
- [ ] Full disk encryption enabled on data volumes

### Network

- [ ] TLS 1.2+ enforced on all external connections
- [ ] HSTS enabled with long max-age
- [ ] Internal services bound to loopback (127.0.0.1) or Docker network only
- [ ] CORS origins restricted to application domain(s)
- [ ] Rate limiting configured on all public endpoints
- [ ] WAF (Web Application Firewall) deployed (recommended)
- [ ] No internal service ports exposed to public internet

### Application

- [ ] `NODE_ENV=production` set for API
- [ ] JWT signing key is a strong, randomly generated secret
- [ ] Encryption key is a full 256-bit key
- [ ] Session timeout set to 15 minutes or less
- [ ] Multi-factor authentication enabled and enforced
- [ ] FHIR `allow_multiple_delete` set to `false`
- [ ] Debug/development endpoints disabled
- [ ] Error messages do not leak implementation details
- [ ] All PHI fields encrypted at rest (SSN, notes, etc.)
- [ ] No test/seed data in production database

### Audit and Compliance

- [ ] Audit logging enabled and verified
- [ ] Audit chain integrity verified
- [ ] Audit log backup procedure in place
- [ ] HIPAA risk assessment completed
- [ ] BAAs in place with all infrastructure providers
- [ ] Incident response plan documented
- [ ] Data retention policy implemented
- [ ] User access review procedure scheduled (quarterly)

### Backup and Recovery

- [ ] Automated daily database backups configured
- [ ] Backups encrypted at rest
- [ ] Off-site backup storage configured
- [ ] Backup restoration tested and verified
- [ ] Recovery time objective (RTO) documented and achievable
- [ ] Recovery point objective (RPO) documented and achievable

---

## 12. Maintenance Procedures

### 12.1 Routine Maintenance Schedule

| Task | Frequency | Procedure |
|------|-----------|-----------|
| Security patches (OS) | Weekly | `apt update && apt upgrade -y` (or equivalent) |
| Docker image updates | Monthly | Review and update base images |
| Database VACUUM | Weekly (automatic) | PostgreSQL autovacuum; manual VACUUM ANALYZE monthly |
| Certificate renewal check | Weekly | Verify certificate expiry > 30 days |
| Audit chain verification | Daily | Run `GET /api/v1/audit/verify` |
| Backup verification | Monthly | Restore backup to test environment |
| User access review | Quarterly | Review active users and role assignments |
| Dependency updates | Monthly | `npm audit`, review and update dependencies |
| Performance review | Monthly | Review metrics dashboards, optimize as needed |
| Security scan | Quarterly | Run vulnerability scanner against infrastructure |

### 12.2 Updating the Application

```bash
# Pull latest changes
cd /opt/tribal-ehr
git fetch origin
git checkout main
git pull origin main

# Build new images
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Run database migrations
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec api npm run db:migrate

# Rolling restart (zero-downtime if load balanced)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps api
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps frontend
```

### 12.3 Emergency Procedures

**Service Recovery:**

```bash
# Restart a single service
docker compose restart api

# View logs for troubleshooting
docker compose logs --tail=100 -f api

# Force recreate a container
docker compose up -d --force-recreate api
```

**Database Emergency:**

```bash
# Check PostgreSQL status
docker compose exec postgres pg_isready

# Check active connections
docker compose exec postgres psql -U ehr_admin -d tribal_ehr -c "SELECT count(*) FROM pg_stat_activity;"

# Kill long-running queries (use with caution)
docker compose exec postgres psql -U ehr_admin -d tribal_ehr -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '5 minutes' AND pid <> pg_backend_pid();"
```

**Full System Recovery:**

```bash
# Stop all services
docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# Start infrastructure first
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres redis rabbitmq

# Wait for infrastructure health
sleep 30

# Start FHIR server
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d hapi-fhir

# Wait for FHIR server (can take 1-2 minutes)
sleep 120

# Start application
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d api frontend

# Verify all services
docker compose ps
```
