# Deployment Guide

**Version:** 1.0.0  
**Status:** Ready for Implementation

---

## 🚀 Quick Start

### Prerequisites

```bash
# Required
Node.js >= 18.x
npm >= 9.x
Git

# Recommended
Docker (for PostgreSQL)
```

### Development Setup

```bash
# Clone repository
git clone <repo-url>
cd self-mastery-os

# Install dependencies (root)
npm install

# Install dependencies (packages)
cd packages/frontend && npm install
cd ../backend && npm install

# Set up environment files
cd packages/backend
cp .env.example .env
# Edit .env with your values

# Initialize database
npm run db:init

# Start development servers (from root)
npm run dev
```

---

## 📁 Environment Variables

### Backend (`.env`)

```bash
# Server
NODE_ENV=development
PORT=3001
API_URL=http://localhost:3001

# Database
DATABASE_URL=sqlite:./dev.db
# Production: DATABASE_URL=postgresql://user:password@localhost:5432/selfmastery

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# CORS
FRONTEND_URL=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### Frontend (`.env`)

```bash
# API
VITE_API_URL=http://localhost:3001/api/v1

# App
VITE_APP_NAME=Self-Mastery OS
VITE_APP_VERSION=1.0.0
```

---

## 🗄️ Database Setup

### SQLite (Development)

```bash
# From packages/backend
npm run db:init
```

This creates:
- `dev.db` - SQLite database file
- All tables from schema
- Default indexes

### PostgreSQL (Production)

**Option 1: Docker**

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: selfmastery-db
    environment:
      POSTGRES_USER: selfmastery
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: selfmastery
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U selfmastery"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

```bash
# Start PostgreSQL
docker-compose up -d postgres

# Run migrations
cd packages/backend
npm run db:migrate
```

**Option 2: Managed Service (Recommended for Production)**

| Provider | Service | Tier |
|----------|---------|------|
| Supabase | PostgreSQL | Free tier available |
| Railway | PostgreSQL | $5/month |
| Render | PostgreSQL | Free tier available |
| AWS | RDS PostgreSQL | Pay-as-you-go |

---

## 🏗️ Build & Run

### Backend

```bash
cd packages/backend

# Development
npm run dev

# Build
npm run build

# Production
npm run start
```

### Frontend

```bash
cd packages/frontend

# Development
npm run dev

# Build
npm run build

# Preview production build
npm run preview
```

---

## 📦 Deployment Options

### Option 1: VPS (DigitalOcean, Linode, Hetzner)

**Server Setup:**

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Clone repo
git clone <repo-url> /var/www/selfmastery
cd /var/www/selfmastery

# Install dependencies
npm install
cd packages/frontend && npm install
cd ../backend && npm install

# Build
cd packages/frontend && npm run build
cd ../backend && npm run build

# Set up environment
cp .env.example .env
# Edit .env

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

**Nginx Configuration:**

```nginx
# /etc/nginx/sites-available/selfmastery
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        root /var/www/selfmastery/packages/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/selfmastery /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# SSL with Let's Encrypt
sudo certbot --nginx -d yourdomain.com
```

---

### Option 2: Platform-as-a-Service (Easier)

#### Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy backend
cd packages/backend
railway up

# Deploy frontend
cd ../frontend
railway up
```

**railway.json (Backend):**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run start",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 100
  }
}
```

#### Render

```yaml
# render.yaml
services:
  - type: web
    name: selfmastery-backend
    env: node
    buildCommand: cd packages/backend && npm install && npm run build
    startCommand: cd packages/backend && npm run start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: selfmastery-db
          property: connectionString

  - type: web
    name: selfmastery-frontend
    env: static
    buildCommand: cd packages/frontend && npm install && npm run build
    staticPublishPath: packages/frontend/dist
    envVars:
      - key: VITE_API_URL
        value: https://selfmastery-backend.onrender.com/api/v1

databases:
  - name: selfmastery-db
    databaseName: selfmastery
    user: selfmastery
```

---

### Option 3: Docker (Full Containerization)

**Dockerfile (Backend):**

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY packages/backend/package*.json ./
COPY packages/backend/tsconfig*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY packages/backend/src ./src

# Build
RUN npm run build

# Production image
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY packages/backend/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3001

# Start
CMD ["npm", "run", "start"]
```

**Dockerfile (Frontend):**

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY packages/frontend/package*.json ./
RUN npm ci

COPY packages/frontend/ ./
RUN npm run build

# Nginx for serving static files
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**docker-compose.yml (Production):**

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: .
      dockerfile: packages/frontend/Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend

  backend:
    build:
      context: .
      dockerfile: packages/backend/Dockerfile
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://selfmastery:password@db:5432/selfmastery
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: selfmastery
      POSTGRES_PASSWORD: password
      POSTGRES_DB: selfmastery
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

```bash
# Build and run
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

---

## 🔒 Security Checklist

### Before Production

- [ ] Change all default passwords
- [ ] Generate strong JWT secrets (`openssl rand -base64 32`)
- [ ] Enable HTTPS (SSL certificate)
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Enable database backups
- [ ] Configure error logging
- [ ] Set up monitoring/alerting

### Environment Variables (Production)

```bash
# NEVER commit these to git
# Use .env files (gitignored) or secret management

# Good practices:
- Use different secrets per environment
- Rotate secrets regularly
- Use secret management services (AWS Secrets Manager, Doppler)
```

---

## 📊 Monitoring & Logging

### Application Monitoring

**Option 1: PM2 (Simple)**

```bash
# Install PM2
npm install -g pm2

# Start app
pm2 start ecosystem.config.js

# View logs
pm2 logs

# Monitor
pm2 monit

# Save process list
pm2 save
```

**Option 2: Managed Services**

| Service | Purpose | Cost |
|---------|---------|------|
| Sentry | Error tracking | Free tier |
| LogRocket | Session replay | Paid |
| Datadog | Full observability | Paid |
| Better Stack | Logging & monitoring | Free tier |

### Health Check Endpoint

```typescript
// backend/src/routes/health.ts
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Railway
        uses: railwayapp/deploy@v1
        with:
          railway-token: ${{ secrets.RAILWAY_TOKEN }}
```

---

## 📈 Scaling Considerations

### When to Scale

| Metric | Threshold | Action |
|--------|-----------|--------|
| Daily Active Users | >1,000 | Add database connection pooling |
| API Response Time | >200ms | Add Redis caching |
| Database Size | >1GB | Add read replicas |
| Server CPU | >70% sustained | Horizontal scaling |

### Scaling Architecture

```
Phase 1 (Current):
┌─────────────┐
│ Single Server│
│ + SQLite    │
└─────────────┘

Phase 2 (1K users):
┌─────────────┐
│ Load Balancer│
└──────┬──────┘
       │
  ┌────┴────┐
  ▼         ▼
┌─────┐ ┌─────┐
│API 1│ │API 2│
└──┬──┘ └──┬──┘
   │       │
   └───┬───┘
       ▼
  ┌────────┐
  │PostgreSQL│
  └────────┘

Phase 3 (10K users):
┌─────────────┐
│    CDN      │
└──────┬──────┘
       │
┌──────┴──────┐
│Load Balancer│
└──────┬──────┘
       │
  ┌────┴────┬────┐
  ▼         ▼    ▼
┌─────┐ ┌─────┐ ┌─────┐
│API 1│ │API 2│ │API 3│
└──┬──┘ └──┬──┘ └──┬──┘
   │       │       │
   └───┬───┴───┬───┘
       │       │
       ▼       ▼
  ┌────────┐ ┌──────┐
  │PostgreSQL│ │Redis │
  │  Pool   │ │Cache │
  └────────┘ └──────┘
```

---

## 🐛 Troubleshooting

### Common Issues

**Database Connection Failed:**

```bash
# Check database is running
docker-compose ps

# Verify connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

**Port Already in Use:**

```bash
# Find process using port
lsof -i :3001

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=3002
```

**Build Fails:**

```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install

# Clear TypeScript cache
rm -rf dist
npm run build
```

---

## 📋 Deployment Checklist

### Pre-Launch

- [ ] All tests passing
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] SSL certificate installed
- [ ] CORS configured
- [ ] Rate limiting enabled
- [ ] Error tracking set up
- [ ] Backups configured

### Launch Day

- [ ] Deploy backend
- [ ] Deploy frontend
- [ ] Verify health endpoints
- [ ] Test authentication flow
- [ ] Test core features
- [ ] Monitor logs for errors

### Post-Launch

- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Gather user feedback
- [ ] Plan iteration cycle

---

## 🎯 Next Steps

1. **Set up development environment**
2. **Initialize database**
3. **Build authentication flow**
4. **Test locally**
5. **Deploy to staging**
6. **User testing**
7. **Production launch**

**Last Updated:** 2026-02-23
