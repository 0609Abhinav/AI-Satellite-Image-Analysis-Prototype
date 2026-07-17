# AI-Powered Satellite/Aerial Image Analysis PoC

Local learning project for Docker and Kubernetes using a React frontend, FastAPI backend, PostgreSQL, Redis, and MinIO object storage.

This project is intentionally local-first:

- No AWS, Azure, or Google Cloud.
- No ECR, EKS, S3, or paid cloud storage.
- Docker Desktop runs the containers.
- Minikube runs Kubernetes locally.
- MinIO is used as a free local S3-compatible object store.

## Current Architecture

```text
Browser
  |
  v
React frontend
  |
  v
FastAPI backend
  |
  +--> PostgreSQL stores image, analysis, and comparison metadata
  |
  +--> Redis stores short-lived processing status
  |
  +--> MinIO stores uploaded images and generated result files
```

In Kubernetes, the app becomes:

```text
Browser
  |
  v
Frontend Service
  |
  v
Frontend Pods
  |
  v
Backend Service
  |
  v
Backend Pods
  |
  +--> PostgreSQL Service/Pod
  +--> Redis Service/Pod
  +--> MinIO Service/Pod
```

The backend has multiple replicas in Kubernetes so you can practice load balancing and self-healing. If one backend Pod is deleted, Kubernetes creates a replacement Pod automatically.

## Important Files

| File | Purpose |
| --- | --- |
| `docker-compose.yml` | Runs PostgreSQL, Redis, MinIO, backend, and frontend together on your local machine. |
| `backend/Dockerfile` | Builds the FastAPI backend image. |
| `backend/.dockerignore` | Keeps unnecessary backend files out of the Docker image. |
| `frontend/Dockerfile` | Builds the React app and serves it with Nginx. |
| `frontend/.dockerignore` | Keeps frontend build/cache files out of the Docker image. |
| `k8s/*.yaml` | Kubernetes Namespace, ConfigMap, Secret, Deployments, Services, and PVCs. |
| `DOCKER_KUBERNETES_COMMANDS.md` | Command cheat sheet for Docker Compose, logs, rebuilds, and Kubernetes checks. |
| `DOCKER_KUBERNETES_GUIDE.md` | Detailed learning guide explaining how Docker and Kubernetes are connected in this project. |

## Local Python Backend Run

Use this when you want to run the backend normally with Uvicorn, outside Docker.

First start only the supporting services:

```bash
docker compose up -d postgres redis minio
```

This starts:

- PostgreSQL on local port `5433`
- Redis on local port `6379`
- MinIO API on local port `9000`
- MinIO Console on local port `9001`

Then run the backend:

```bash
cd backend
source ../.venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Check the backend:

```bash
curl http://127.0.0.1:8000/health
```

Run the frontend locally:

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

```text
http://127.0.0.1:5173
```

## Docker Compose Run

Use this when you want the full app running in Docker.

```bash
docker compose up --build
```

What happens internally:

1. Docker builds the backend image from `backend/Dockerfile`.
2. Docker builds the frontend image from `frontend/Dockerfile`.
3. Docker creates a private Compose network.
4. PostgreSQL, Redis, MinIO, backend, and frontend containers join that network.
5. The backend connects to services by container name, for example `postgres`, `redis`, and `minio`.
6. Docker publishes selected container ports to your Mac.

Open:

```text
Frontend:      http://127.0.0.1:5173
Backend API:   http://127.0.0.1:8000
MinIO Console: http://127.0.0.1:9001
```

MinIO login:

```text
Username: minioadmin
Password: minioadmin
```

Stop containers:

```bash
docker compose down
```

Stop containers and delete named volumes:

```bash
docker compose down -v
```

Only use `docker compose down -v` when you are okay deleting local PostgreSQL, Redis, and MinIO data.

## Docker Logs

Backend logs, similar to watching Uvicorn output:

```bash
docker compose logs -f backend
```

Frontend logs:

```bash
docker compose logs -f frontend
```

Database logs:

```bash
docker compose logs -f postgres
```

Redis logs:

```bash
docker compose logs -f redis
```

MinIO logs:

```bash
docker compose logs -f minio
```

Run a shell inside the backend container:

```bash
docker compose exec backend bash
```

## Rebuild Docker Images

Rebuild everything:

```bash
docker compose build --no-cache
docker compose up
```

Rebuild only backend:

```bash
docker compose build backend
docker compose up backend
```

Rebuild only frontend:

```bash
docker compose build frontend
docker compose up frontend
```

## Kubernetes With Minikube

Start Minikube:

```bash
minikube start
```

Point your shell to Minikube's Docker engine:

```bash
eval $(minikube docker-env)
```

Build images inside Minikube:

```bash
docker build -t ai-poweredsatellite-backend:latest ./backend
docker build -t ai-poweredsatellite-frontend:latest ./frontend
```

Deploy everything:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/minio.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
```

Check Pods:

```bash
kubectl get pods -n satellite
```

Check Services:

```bash
kubectl get services -n satellite
```

Open frontend:

```bash
minikube service frontend -n satellite
```

Open backend:

```bash
minikube service backend -n satellite
```

## Kubernetes Logs

Backend logs from all backend Pods:

```bash
kubectl logs -n satellite -l app=backend -f
```

Logs from one specific backend Pod:

```bash
kubectl get pods -n satellite -l app=backend
kubectl logs -n satellite POD_NAME -f
```

Previous logs after a crash or restart:

```bash
kubectl logs -n satellite POD_NAME --previous
```

Describe a failing Pod:

```bash
kubectl describe pod -n satellite POD_NAME
```

This shows events such as image pull errors, failed health checks, crashes, restarts, and scheduling problems.

## Test Kubernetes Self-Healing

List backend Pods:

```bash
kubectl get pods -n satellite -l app=backend
```

Delete one backend Pod:

```bash
kubectl delete pod -n satellite POD_NAME
```

Watch Kubernetes create a replacement:

```bash
kubectl get pods -n satellite -l app=backend -w
```

Why this works:

- The backend is managed by a Deployment.
- The Deployment owns a ReplicaSet.
- The ReplicaSet keeps the desired number of Pods running.
- When one Pod disappears, the ReplicaSet creates a new Pod.
- The backend Service sends traffic only to ready backend Pods.

## Scale Backend Replicas

Increase backend replicas:

```bash
kubectl scale deployment backend -n satellite --replicas=3
```

Check the new Pods:

```bash
kubectl get pods -n satellite -l app=backend
```

Decrease backend replicas:

```bash
kubectl scale deployment backend -n satellite --replicas=2
```

## Rolling Restart After Rebuilding Images

After changing backend code:

```bash
eval $(minikube docker-env)
docker build -t ai-poweredsatellite-backend:latest ./backend
kubectl rollout restart deployment/backend -n satellite
kubectl rollout status deployment/backend -n satellite
```

After changing frontend code:

```bash
eval $(minikube docker-env)
docker build -t ai-poweredsatellite-frontend:latest ./frontend
kubectl rollout restart deployment/frontend -n satellite
kubectl rollout status deployment/frontend -n satellite
```

Roll back a Deployment:

```bash
kubectl rollout undo deployment/backend -n satellite
```

View rollout history:

```bash
kubectl rollout history deployment/backend -n satellite
```

## Image Preview Fix

Uploads and generated result images are stored in MinIO.

The frontend should not directly load private MinIO container URLs. Instead, the backend exposes object URLs like:

```text
/objects/{bucket}/{object_key}
```

The browser calls the backend, and the backend streams the image from MinIO. This is why image previews can work from normal local runs, Docker Compose, and Kubernetes.

## Environment Variables

Common local values are documented in `.env.example`.

Important variables:

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. |
| `REDIS_URL` | Redis connection string. |
| `MINIO_ENDPOINT` | MinIO API address. |
| `MINIO_ACCESS_KEY` | MinIO username/access key. |
| `MINIO_SECRET_KEY` | MinIO password/secret key. |
| `MINIO_UPLOADS_BUCKET` | Bucket for uploaded images. |
| `MINIO_RESULTS_BUCKET` | Bucket for generated analysis files. |
| `OBJECT_CACHE_DIR` | Local cache directory for files pulled from object storage. |
| `MODEL_CACHE_DIR` | Local cache directory for AI model files. |

## API Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Check backend health and configured paths. |
| `POST /upload` | Upload PNG/JPG/JPEG images. |
| `POST /analyze/{image_id}` | Run object detection and segmentation for one image. |
| `GET /analysis/{image_id}` | Read latest analysis for an image. |
| `POST /compare` | Compare two uploaded images. |
| `GET /objects/{bucket}/{object_key}` | Stream MinIO objects through the backend. |

## Accuracy And Limitations

The current AI pipeline uses real local open-source models:

- Grounding DINO for open-vocabulary detection.
- Segment Anything for segmentation masks.
- OpenCV fallback only for troubleshooting.

CPU inference can be slow, especially on large images. First analysis is slower because model weights are loaded and cached under `models/cache`.

This is a local learning setup, not a production deployment. Production would usually add authentication, background workers, stronger secrets management, external object storage, backups, monitoring, ingress/TLS, GPU inference, and managed Kubernetes.
