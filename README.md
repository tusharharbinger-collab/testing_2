# testing_2

A lightweight, production-ready Full-Stack To-Do List application designed for containerized deployment in CI/CD platforms with AWS ALB health check targets and built-in chaos engineering hooks for canary rollback verification (Mann-Whitney U test for latency and Wald SPRT for error spikes).

## Features

- **Runtime**: Minimal Node.js Express service with zero external database dependencies (clean in-memory state).
- **Frontend**: Responsive single-file modern Web UI served from `public/` featuring dark/light theme, active/completed filters, and interactive chaos switch.
- **ALB Health Checks**: Dedicated `/health` and `/healthz` endpoints responding in `<5ms` with `{"status": "ok", "version": "1.0.0"}`.
- **Chaos Testing Hooks**: Built-in triggers for automated CI/CD automated rollback verification:
  - `?chaos=latency` or `CHAOS_LATENCY=true`: Injects an artificial 300ms delay to simulate latency regression (Mann-Whitney U test).
  - `?chaos=error` or `CHAOS_ERROR=true`: Randomly fails 20% of API requests with HTTP 500 (Wald SPRT test).
- **Containerization**: Alpine-based minimal image with `curl` installed and Docker `HEALTHCHECK` configured.

---

## API Endpoints

| Endpoint | Method | Description | Chaos Applied |
| :--- | :--- | :--- | :--- |
| `/` | `GET` | Serves the To-Do List Web UI | No |
| `/health` | `GET` | AWS ALB Target Group Health Check (`200 OK`) | No (Immediate) |
| `/healthz` | `GET` | Kubernetes / Container Liveness Probe (`200 OK`) | No (Immediate) |
| `/api/todos` | `GET` | Retrieves all to-do items | Yes (via flag/env) |
| `/api/todos` | `POST` | Creates a new to-do item `{ "title": "Buy milk" }` | Yes (via flag/env) |
| `/api/todos/:id` | `PATCH` | Toggles or updates a to-do item's completion status | Yes (via flag/env) |
| `/api/todos/:id` | `DELETE`| Deletes a to-do item by ID | Yes (via flag/env) |
| `/api/chaos-status` | `GET` | Returns active chaos environment configurations | No |

---

## Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Application
```bash
npm start
```

Access the UI at `http://localhost:8080` and health probe at `http://localhost:8080/health`.

---

## Docker & Container Deployment

### Build Image
```bash
docker build -t testing_2:latest .
```

### Run Container
```bash
docker run -d -p 8080:8080 --name todo-app testing_2:latest
```

### Run Container with Chaos Latency Simulation
```bash
docker run -d -p 8080:8080 -e CHAOS_LATENCY=true --name todo-latency testing_2:latest
```

### Run Container with Chaos Error Spike Simulation
```bash
docker run -d -p 8080:8080 -e CHAOS_ERROR=true --name todo-errors testing_2:latest
```

---

## Testing Chaos Hooks with cURL

```bash
# Clean Request (< 20ms)
curl -i "http://localhost:8080/api/todos"

# Simulate Latency Regression (+300ms)
curl -i "http://localhost:8080/api/todos?chaos=latency"

# Simulate 20% HTTP 500 Error Spikes
curl -i "http://localhost:8080/api/todos?chaos=error"

# ALB Health Check (Always fast and 200 OK)
curl -i "http://localhost:8080/health"
```
