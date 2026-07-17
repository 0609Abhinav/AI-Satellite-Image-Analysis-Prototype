# Complete Docker and Kubernetes Guide

This guide explains how this project was moved from a normal local app to Docker Compose and then to local Kubernetes with Minikube.

## Final Local Architecture

```text
Browser
  |
  v
React Frontend
  |
  v
FastAPI Backend
  |
  +--> PostgreSQL
  |
  +--> Redis
  |
  +--> MinIO
```

Everything runs locally. There is no AWS, Azure, GCP, ECR, or EKS.

## Why We Added Docker

Before Docker, each service had to be started manually:

```text
backend with uvicorn
frontend with npm
database manually
redis manually
object storage manually
```

Docker lets us package each part into containers.

Docker Compose lets us run all containers together with one command:

```bash
docker compose up -d
```

## Why We Added Kubernetes

Docker Compose starts containers, but it does not teach production-style orchestration.

Kubernetes gives us:

```text
replicas
self-healing
load balancing
rollouts
service discovery
health checks
scaling
```

The most important example:

```yaml
replicas: 2
```

This tells Kubernetes:

```text
Always keep 2 backend Pods running.
```

If one backend Pod dies, Kubernetes creates another one.

## Docker Images We Created

We created two main app images:

```text
ai-poweredsatellite-backend:latest
ai-poweredsatellite-frontend:latest
```

These images are built from:

```text
backend/Dockerfile
frontend/Dockerfile
```

An image is a packaged filesystem that contains:

```text
base operating system
runtime
dependencies
application code
startup command
```

A container is a running instance of an image.

## Backend Dockerfile

File:

```text
backend/Dockerfile
```

Current purpose:

```text
Build a FastAPI backend image.
Install Python dependencies.
Run Uvicorn on port 8000.
```

Important lines:

```dockerfile
FROM python:3.12-slim
```

This starts from a small official Python image.

```dockerfile
WORKDIR /app
```

This sets `/app` as the working folder inside the container.

```dockerfile
COPY requirements.txt .
COPY requirements.docker.txt .
```

This copies dependency files first.

Why first?

Docker caches layers. If dependencies do not change, Docker does not reinstall everything.

```dockerfile
RUN pip install --no-cache-dir \
    torch==2.2.2+cpu \
    torchvision==0.17.2+cpu \
    --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.docker.txt
```

This installs CPU-only PyTorch and then the rest of the backend dependencies.

Why CPU-only?

The default PyTorch Linux install tried to download CUDA/GPU packages. For local Docker Desktop learning, CPU-only is smaller and more appropriate.

```dockerfile
COPY app ./app
```

This copies the FastAPI source code into the image.

```dockerfile
EXPOSE 8000
```

This documents that the app listens on port 8000.

```dockerfile
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

This starts FastAPI inside the container.

Why `0.0.0.0`?

Inside a container, `127.0.0.1` means only inside that container. `0.0.0.0` allows Docker/Kubernetes to route traffic into the container.

## Docker-Specific Backend Requirements

File:

```text
backend/requirements.docker.txt
```

Why it exists:

The normal `requirements.txt` includes:

```text
torch
torchvision
```

For Docker, we install CPU-only Torch separately, then install the rest of the packages from `requirements.docker.txt`.

This avoids pulling large CUDA/GPU packages.

## Frontend Dockerfile

File:

```text
frontend/Dockerfile
```

Purpose:

```text
Build React app using Node.
Serve final static files using Nginx.
```

Important lines:

```dockerfile
FROM node:22-bookworm-slim AS build
```

This starts a Node builder stage.

We originally tried Alpine, but `esbuild` hit a native binary error:

```text
ETXTBSY
```

So we switched to Debian slim for a more reliable frontend build.

```dockerfile
WORKDIR /app
```

Sets the working folder.

```dockerfile
COPY package*.json ./
```

Copies `package.json` and `package-lock.json`.

```dockerfile
RUN npm ci
```

Installs exact locked dependencies.

`npm ci` is better than `npm install` for containers because it uses the lockfile exactly.

```dockerfile
COPY . .
```

Copies frontend source code.

```dockerfile
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
```

Sets the backend URL at build time for Vite.

```dockerfile
RUN npm run build
```

Builds the production React app into `dist/`.

```dockerfile
FROM nginx:1.27-alpine
```

Starts a small runtime image.

```dockerfile
COPY --from=build /app/dist /usr/share/nginx/html
```

Copies only the built frontend files into Nginx.

```dockerfile
EXPOSE 80
```

Nginx serves HTTP on port 80 inside the container.

```dockerfile
CMD ["nginx", "-g", "daemon off;"]
```

Starts Nginx.

## Why Multi-Stage Frontend Build

The frontend image has two stages:

```text
Node build stage
Nginx runtime stage
```

This means:

```text
Node is used only to build the app.
Nginx serves the final static files.
The final image does not need Node or npm.
```

That is a common production pattern.

## Docker Ignore Files

Files:

```text
backend/.dockerignore
frontend/.dockerignore
```

These prevent unnecessary files from being copied into images.

Examples:

```text
node_modules/
dist/
.env
uploads/
results/
models/cache/
satellite_poc.db
```

Why this matters:

```text
smaller build context
faster builds
fewer accidental secrets
cleaner images
```

## Docker Compose File

File:

```text
docker-compose.yml
```

It defines:

```text
postgres
redis
minio
backend
frontend
```

## Docker Compose Services

### PostgreSQL

```yaml
postgres:
  image: postgres:16-alpine
```

Runs PostgreSQL.

```yaml
ports:
  - "5433:5432"
```

Meaning:

```text
localhost:5433 on your Mac
forwards to
5432 inside the PostgreSQL container
```

We used `5433` because your Mac already had something using `5432`.

```yaml
volumes:
  - postgres_data:/var/lib/postgresql/data
```

This stores database data in a named volume.

Without this, data can disappear when containers are recreated.

### Redis

```yaml
redis:
  image: redis:7-alpine
```

Runs Redis.

```yaml
command: ["redis-server", "--appendonly", "yes"]
```

Enables append-only persistence.

```yaml
ports:
  - "6379:6379"
```

Exposes Redis locally.

### MinIO

```yaml
minio:
  image: minio/minio:RELEASE.2025-04-22T22-12-26Z
```

Runs local object storage.

```yaml
command: ["server", "/data", "--console-address", ":9001"]
```

Starts MinIO API on port 9000 and console on port 9001.

```yaml
ports:
  - "9000:9000"
  - "9001:9001"
```

Browser URLs:

```text
MinIO API:     http://localhost:9000
MinIO Console: http://localhost:9001
```

### Backend

```yaml
backend:
  build:
    context: ./backend
```

Builds the backend image from `backend/Dockerfile`.

```yaml
DATABASE_URL: postgresql://satellite:satellite@postgres:5432/satellite
REDIS_URL: redis://redis:6379/0
MINIO_ENDPOINT: host.docker.internal:9000
```

Important networking idea:

Inside Docker Compose, containers can talk using service names:

```text
postgres
redis
minio
```

But for MinIO image preview we needed browser-reachable URLs.

We later fixed image previews by making the backend proxy object files through:

```text
/objects/{bucket}/{object_key}
```

### Frontend

```yaml
frontend:
  build:
    context: ./frontend
    args:
      VITE_API_BASE_URL: http://localhost:8000
```

This builds React with backend API URL:

```text
http://localhost:8000
```

The frontend runs at:

```text
http://localhost:5173
```

## Backend Code Changes For PostgreSQL, Redis, and MinIO

### PostgreSQL Connection

File:

```text
backend/app/core/database.py
```

Before:

```text
sqlite3
```

After:

```text
psycopg
PostgreSQL
```

Major idea:

```python
return psycopg.connect(self.url, row_factory=dict_row)
```

This connects to PostgreSQL using `DATABASE_URL`.

The app still exposes simple helper methods:

```text
execute()
fetch_one()
fetch_all()
```

So the rest of the app can keep using a small database wrapper.

### Redis Client

File:

```text
backend/app/core/redis_client.py
```

Purpose:

```text
connect to Redis
ping Redis on startup
store analysis/comparison status
```

Example:

```python
redis_client.set_status(f"analysis:{analysis_id}:status", "processing")
```

This stores temporary job state in Redis.

### MinIO Object Storage

File:

```text
backend/app/core/object_storage.py
```

Purpose:

```text
connect to MinIO
create buckets
upload bytes
upload files
download files
stream objects
```

Important methods:

```text
init()
upload_bytes()
upload_file()
download_file()
get_object()
presigned_url()
```

### Storage Service

File:

```text
backend/app/services/storage.py
```

Before:

```text
uploaded image saved directly to local uploads folder
frontend URL pointed to /uploads/...
```

After:

```text
uploaded image is validated locally
image is uploaded to MinIO
metadata is stored in PostgreSQL
frontend receives /objects/... URL
```

Important helper:

```python
def object_url(bucket: str, object_key: str) -> str:
    return f"/objects/{quote(bucket, safe='')}/{quote(object_key, safe='/')}"
```

This returns browser-safe backend-relative URLs.

Example:

```text
/objects/satellite-uploads/image123.png
```

### Object Proxy Endpoint

File:

```text
backend/app/api/routes.py
```

Added endpoint:

```python
@router.get("/objects/{bucket}/{object_key:path}")
async def get_object(bucket: str, object_key: str) -> StreamingResponse:
```

Purpose:

```text
Browser requests image from backend.
Backend fetches object from MinIO.
Backend streams image back to browser.
```

Why this was needed:

Docker/Kubernetes internal URLs like these are not always browser reachable:

```text
minio:9000
host.docker.internal:9000
```

The browser should use:

```text
http://localhost:8000/objects/...
```

The backend then talks to MinIO internally.

This fixed broken image preview.

## Kubernetes Files

All Kubernetes files are in:

```text
k8s/
```

## Namespace

File:

```text
k8s/namespace.yaml
```

Creates:

```text
satellite namespace
```

Why:

```text
keeps project resources grouped together
```

## ConfigMap

File:

```text
k8s/configmap.yaml
```

Stores non-secret environment variables:

```text
DATABASE_URL
REDIS_URL
MINIO_ENDPOINT
MODEL_BACKEND
PROJECT_ROOT
```

Example:

```yaml
DATABASE_URL: postgresql://satellite:satellite@postgres:5432/satellite
REDIS_URL: redis://redis:6379/0
MINIO_ENDPOINT: minio:9000
```

Important:

In Kubernetes, the backend connects to services by Kubernetes Service name:

```text
postgres
redis
minio
```

## Secret

File:

```text
k8s/secret.yaml
```

Stores sensitive values:

```text
POSTGRES_PASSWORD
MINIO_ACCESS_KEY
MINIO_SECRET_KEY
```

For local learning this is fine.

In production, use stronger secret management.

## PostgreSQL Kubernetes File

File:

```text
k8s/postgres.yaml
```

Creates:

```text
PersistentVolumeClaim
Deployment
Service
```

### PersistentVolumeClaim

Requests disk storage:

```yaml
storage: 1Gi
```

### Deployment

Runs PostgreSQL Pod:

```yaml
image: postgres:16-alpine
```

### Service

Creates stable DNS name:

```text
postgres
```

Backend uses:

```text
postgres:5432
```

## Redis Kubernetes File

File:

```text
k8s/redis.yaml
```

Creates:

```text
Redis PVC
Redis Deployment
Redis Service
```

Backend uses:

```text
redis:6379
```

## MinIO Kubernetes File

File:

```text
k8s/minio.yaml
```

Creates:

```text
MinIO PVC
MinIO Deployment
MinIO Service
```

Backend uses:

```text
minio:9000
```

## Backend Kubernetes File

File:

```text
k8s/backend.yaml
```

Creates:

```text
Backend Deployment
Backend Service
```

Important part:

```yaml
replicas: 2
```

This creates two backend Pods.

Why:

```text
load balancing
self-healing
availability
```

Image:

```yaml
image: ai-poweredsatellite-backend:latest
imagePullPolicy: IfNotPresent
```

This tells Kubernetes:

```text
use the local image loaded into Minikube
do not always pull from Docker Hub
```

Environment:

```yaml
envFrom:
  - configMapRef:
      name: satellite-config
```

This loads ConfigMap values into the backend container.

Secrets:

```yaml
secretKeyRef:
  name: satellite-secret
```

This loads MinIO credentials securely.

Health checks:

```yaml
startupProbe
readinessProbe
livenessProbe
```

### startupProbe

Gives the backend time to start.

This matters because the backend imports heavy ML dependencies.

### readinessProbe

Controls whether traffic is sent to the Pod.

If readiness fails:

```text
Service does not send traffic to that Pod.
```

### livenessProbe

Controls whether Kubernetes restarts the container.

If liveness fails repeatedly:

```text
Kubernetes restarts the backend container.
```

### Backend Service

```yaml
kind: Service
metadata:
  name: backend
```

This creates a stable backend network name.

Selector:

```yaml
selector:
  app: backend
```

This means:

```text
send traffic to Pods with label app=backend
```

If two backend Pods are ready, Service load balances between both.

## Frontend Kubernetes File

File:

```text
k8s/frontend.yaml
```

Creates:

```text
Frontend Deployment
Frontend Service
```

Important:

```yaml
replicas: 2
```

This keeps two frontend Pods running.

Image:

```yaml
image: ai-poweredsatellite-frontend:latest
```

Service exposes frontend through NodePort.

## How Docker Connects To Kubernetes

Docker builds the images:

```bash
docker compose build backend
docker compose build frontend
```

Images created:

```text
ai-poweredsatellite-backend:latest
ai-poweredsatellite-frontend:latest
```

Minikube cannot automatically see Docker Desktop images.

So we load them:

```bash
minikube image load ai-poweredsatellite-backend:latest
minikube image load ai-poweredsatellite-frontend:latest
```

Then Kubernetes YAML references those images:

```yaml
image: ai-poweredsatellite-backend:latest
```

That is the connection:

```text
Dockerfile
  |
  v
Docker image
  |
  v
minikube image load
  |
  v
Kubernetes Deployment uses image
```

## Kubernetes Networking

Kubernetes creates an internal DNS system.

Services become DNS names:

```text
postgres
redis
minio
backend
frontend
```

Backend talks to PostgreSQL:

```text
postgres:5432
```

Backend talks to Redis:

```text
redis:6379
```

Backend talks to MinIO:

```text
minio:9000
```

Frontend talks to backend through the browser URL configured at build time.

## Load Balancing

Backend has two Pods:

```text
backend Pod 1: 10.244.0.11:8000
backend Pod 2: 10.244.0.12:8000
```

Backend Service has one stable name:

```text
backend
```

The Service sends traffic to healthy Pods only.

Check endpoints:

```bash
kubectl get endpoints -n satellite backend
```

Example:

```text
10.244.0.11:8000,10.244.0.12:8000
```

That means both Pods are active load-balancing targets.

## Self-Healing

The Deployment says:

```yaml
replicas: 2
```

If one backend Pod is deleted:

```bash
kubectl delete pod -n satellite <backend-pod-name>
```

Kubernetes sees:

```text
desired state: 2 backend Pods
actual state: 1 backend Pod
```

Then it creates a replacement Pod.

Watch:

```bash
kubectl get pods -n satellite -l app=backend -w
```

## Rolling Updates

When backend code changes:

```bash
docker compose build backend
minikube image load ai-poweredsatellite-backend:latest
kubectl rollout restart deployment/backend -n satellite
kubectl rollout status deployment/backend -n satellite
```

Kubernetes replaces Pods gradually.

This is a rolling update.

## How To Run Docker Compose

```bash
docker compose up -d
```

Open:

```text
http://localhost:5173
```

Backend health:

```text
http://localhost:8000/health
```

MinIO:

```text
http://localhost:9001
```

## How To Run Kubernetes

Start Minikube:

```bash
minikube start --driver=docker
```

Load images:

```bash
minikube image load ai-poweredsatellite-backend:latest
minikube image load ai-poweredsatellite-frontend:latest
```

Apply YAML:

```bash
kubectl apply -f k8s/namespace.yaml -f k8s/secret.yaml -f k8s/configmap.yaml -f k8s/postgres.yaml -f k8s/redis.yaml -f k8s/minio.yaml -f k8s/backend.yaml -f k8s/frontend.yaml
```

Check:

```bash
kubectl get pods -n satellite
kubectl get deployments -n satellite
kubectl get services -n satellite
```

Open frontend:

```bash
minikube service frontend -n satellite --url
```

Open backend:

```bash
minikube service backend -n satellite --url
```

## Debugging Backend In Kubernetes

List backend Pods:

```bash
kubectl get pods -n satellite -l app=backend
```

Follow backend logs:

```bash
kubectl logs -n satellite -f deployment/backend
```

Describe backend Pod:

```bash
kubectl describe pod -n satellite <backend-pod-name>
```

Previous crash logs:

```bash
kubectl logs -n satellite <backend-pod-name> --previous
```

Events:

```bash
kubectl get events -n satellite --sort-by=.lastTimestamp
```

## Docker Compose vs Kubernetes

Docker Compose:

```text
Good for local multi-container development.
Simple.
One machine.
No self-healing beyond basic restart policies.
```

Kubernetes:

```text
Good for orchestration.
Self-healing.
Load balancing.
Scaling.
Rolling updates.
Desired state management.
```

## Key Lesson

Docker answers:

```text
How do I package and run this app?
```

Kubernetes answers:

```text
How do I keep this app running reliably?
```

Together:

```text
Docker builds the images.
Kubernetes runs and manages the images.
```

