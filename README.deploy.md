# OpenHarness Web frontend deployment

This directory is the standalone deployment of the former Web frontend.

The container builds the Vite app with Node, serves `dist/` with Nginx, and proxies `/api/` plus `/api/ws/` to the OpenHarness backend container. `VITE_OPENHARNESS_API_BASE` is intentionally empty by default so the browser sees same-origin API calls and keeps cookie/WebSocket auth simple.

## Commands

```bash
cd /home/cdky/workspace/github/agent_web
bash docker/docker.sh build
bash docker/docker.sh start
bash docker/docker.sh logs
```

Default URL:

```text
http://192.168.88.92:5173
```

Default backend upstream inside Docker:

```text
http://openharness-dev:8787
```

If the backend Compose network changes, edit `docker/env.frontend` and set `OPENHARNESS_BACKEND_NETWORK` and `OPENHARNESS_BACKEND_UPSTREAM` accordingly.
