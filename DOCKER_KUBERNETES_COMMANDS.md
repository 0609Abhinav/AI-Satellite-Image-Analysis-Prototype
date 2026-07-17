# Docker Compose and Kubernetes Commands

This file is a local learning cheat sheet for running this project with Docker Compose and Minikube Kubernetes.

## Project Stack

```text
React frontend
FastAPI backend
PostgreSQL
Redis
MinIO
```

## Docker Compose

Run these commands from the project root:

```bash
cd "/Users/brijeshpant/Desktop/Abhinav/AI-powered satellite"
```

### Start Services

Start the full Docker Compose app:

```bash
docker compose up -d
```

Start only PostgreSQL, Redis, and MinIO:

```bash
docker compose up -d postgres redis minio
```

Start only backend:

```bash
docker compose up -d backend
```

Start only frontend:

```bash
docker compose up -d frontend
```

### Rebuild Images

Rebuild backend image and start backend:

```bash
docker compose up -d --build backend
```

Rebuild frontend image and start frontend:

```bash
docker compose up -d --build frontend
```

Build backend image only:

```bash
docker compose build backend
```

Build frontend image only:

```bash
docker compose build frontend
```

Build all images:

```bash
docker compose build
```

### Check Docker Compose

Show running containers:

```bash
docker compose ps
```

Show backend logs:

```bash
docker compose logs -f backend
```

Show frontend logs:

```bash
docker compose logs -f frontend
```

Show PostgreSQL logs:

```bash
docker compose logs -f postgres
```

Show Redis logs:

```bash
docker compose logs -f redis
```

Show MinIO logs:

```bash
docker compose logs -f minio
```

Validate Compose file:

```bash
docker compose config
```

### Stop Docker Compose

Stop containers but keep data volumes:

```bash
docker compose down
```

Stop containers and delete volumes/data:

```bash
docker compose down -v
```

## Local Backend Without Docker

Use this when you want to run FastAPI directly with Uvicorn, while PostgreSQL, Redis, and MinIO still run in Docker.

From project root:

```bash
source .venv/bin/activate
docker compose up -d postgres redis minio
cd backend
DATABASE_URL="postgresql://satellite:satellite@localhost:5433/satellite" \
REDIS_URL="redis://localhost:6379/0" \
MINIO_ENDPOINT="localhost:9000" \
MINIO_ACCESS_KEY="minioadmin" \
MINIO_SECRET_KEY="minioadmin" \
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

## Minikube Kubernetes

### Start Kubernetes

Start Minikube:

```bash
minikube start --driver=docker
```

Fix kubectl context if needed:

```bash
minikube update-context
```

Check Minikube:

```bash
minikube status
```

Check Kubernetes node:

```bash
kubectl get nodes
```

### Load Local Docker Images Into Minikube

Kubernetes cannot automatically use your normal Docker Desktop images. Load the images into Minikube:

```bash
minikube image load ai-poweredsatellite-backend:latest
minikube image load ai-poweredsatellite-frontend:latest
```

### Deploy Everything To Kubernetes

Apply all Kubernetes YAML files:

```bash
kubectl apply -f k8s/namespace.yaml -f k8s/secret.yaml -f k8s/configmap.yaml -f k8s/postgres.yaml -f k8s/redis.yaml -f k8s/minio.yaml -f k8s/backend.yaml -f k8s/frontend.yaml
```

### Check Kubernetes Status

Check all Pods:

```bash
kubectl get pods -n satellite
```

Check Pods with IPs:

```bash
kubectl get pods -n satellite -o wide
```

Check Deployments:

```bash
kubectl get deployments -n satellite
```

Check Services:

```bash
kubectl get services -n satellite
```

Check backend load-balancing endpoints:

```bash
kubectl get endpoints -n satellite backend
```

Newer endpoint command:

```bash
kubectl get endpointslice -n satellite -l kubernetes.io/service-name=backend
```

Check Kubernetes events:

```bash
kubectl get events -n satellite --sort-by=.lastTimestamp
```

### Open App From Kubernetes

Open frontend:

```bash
minikube service frontend -n satellite --url
```

Open backend:

```bash
minikube service backend -n satellite --url
```

On macOS with the Docker driver, keep the terminal open while using the printed URL.

## Kubernetes Logs

Backend logs:

```bash
kubectl logs -n satellite -f deployment/backend
```

Frontend logs:

```bash
kubectl logs -n satellite -f deployment/frontend
```

PostgreSQL logs:

```bash
kubectl logs -n satellite -f deployment/postgres
```

Redis logs:

```bash
kubectl logs -n satellite -f deployment/redis
```

MinIO logs:

```bash
kubectl logs -n satellite -f deployment/minio
```

List backend Pods:

```bash
kubectl get pods -n satellite -l app=backend
```

Logs from a specific Pod:

```bash
kubectl logs -n satellite <pod-name>
```

Follow logs from a specific Pod:

```bash
kubectl logs -n satellite -f <pod-name>
```

Previous crash logs:

```bash
kubectl logs -n satellite <pod-name> --previous
```

Describe a broken Pod:

```bash
kubectl describe pod -n satellite <pod-name>
```

## Kubernetes Self-Healing

List backend Pods:

```bash
kubectl get pods -n satellite -l app=backend
```

Delete one backend Pod:

```bash
kubectl delete pod -n satellite <backend-pod-name>
```

Watch Kubernetes create a replacement:

```bash
kubectl get pods -n satellite -l app=backend -w
```

Press `Ctrl + C` to stop watching.

Check backend Service endpoints:

```bash
kubectl get endpoints -n satellite backend
```

If two backend Pods are ready, you should see two backend IPs.

## Kubernetes Scaling

Scale backend to 4 Pods:

```bash
kubectl scale deployment backend -n satellite --replicas=4
```

Check backend Pods:

```bash
kubectl get pods -n satellite -l app=backend
```

Check load-balancing endpoints:

```bash
kubectl get endpoints -n satellite backend
```

Scale backend back to 2 Pods:

```bash
kubectl scale deployment backend -n satellite --replicas=2
```

Scale frontend to 4 Pods:

```bash
kubectl scale deployment frontend -n satellite --replicas=4
```

Scale frontend back to 2 Pods:

```bash
kubectl scale deployment frontend -n satellite --replicas=2
```

## Kubernetes Rollouts

Restart backend Deployment:

```bash
kubectl rollout restart deployment/backend -n satellite
```

Watch backend rollout:

```bash
kubectl rollout status deployment/backend -n satellite
```

Backend rollout history:

```bash
kubectl rollout history deployment/backend -n satellite
```

Undo backend rollout:

```bash
kubectl rollout undo deployment/backend -n satellite
```

Restart frontend Deployment:

```bash
kubectl rollout restart deployment/frontend -n satellite
```

Watch frontend rollout:

```bash
kubectl rollout status deployment/frontend -n satellite
```

Frontend rollout history:

```bash
kubectl rollout history deployment/frontend -n satellite
```

Undo frontend rollout:

```bash
kubectl rollout undo deployment/frontend -n satellite
```

## Full Update Flow After Code Changes

### Backend Code Changed

Rebuild Docker backend image:

```bash
docker compose build backend
```

Load backend image into Minikube:

```bash
minikube image load ai-poweredsatellite-backend:latest
```

Restart Kubernetes backend:

```bash
kubectl rollout restart deployment/backend -n satellite
kubectl rollout status deployment/backend -n satellite
```

Check backend:

```bash
kubectl get pods -n satellite -l app=backend
kubectl logs -n satellite -f deployment/backend
```

### Frontend Code Changed

Rebuild Docker frontend image:

```bash
docker compose build frontend
```

Load frontend image into Minikube:

```bash
minikube image load ai-poweredsatellite-frontend:latest
```

Restart Kubernetes frontend:

```bash
kubectl rollout restart deployment/frontend -n satellite
kubectl rollout status deployment/frontend -n satellite
```

Check frontend:

```bash
kubectl get pods -n satellite -l app=frontend
kubectl logs -n satellite -f deployment/frontend
```

## Delete Kubernetes App

Delete all project resources:

```bash
kubectl delete namespace satellite
```

This deletes Pods, Deployments, Services, ConfigMaps, Secrets, and PVCs in the `satellite` namespace.

Stop Minikube:

```bash
minikube stop
```

Delete Minikube cluster:

```bash
minikube delete
```

## Important URLs

Docker Compose frontend:

```text
http://localhost:5173
```

Docker Compose backend:

```text
http://localhost:8000/health
```

Docker Compose MinIO console:

```text
http://localhost:9001
```

MinIO login:

```text
username: minioadmin
password: minioadmin
```

Kubernetes frontend URL:

```bash
minikube service frontend -n satellite --url
```

Kubernetes backend URL:

```bash
minikube service backend -n satellite --url
```

## Mental Model

Docker Compose:

```text
Run these containers together on my machine.
```

Kubernetes:

```text
Keep this desired state running.
If a Pod dies, replace it.
If I ask for 2 replicas, keep 2 healthy replicas.
Use Services to load-balance traffic across healthy Pods.
```

