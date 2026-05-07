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
http://192.168.88.91:5173
```

Default backend upstream:

```text
http://192.168.88.92:8787
```

When the frontend and backend run on different hosts, the frontend container cannot join the backend host's Docker bridge network. Keep `VITE_OPENHARNESS_API_BASE` empty and set `OPENHARNESS_BACKEND_UPSTREAM` to the backend host URL in `docker/env.frontend`.

The compose file uses Docker's default `bridge` network and does not declare an external network, so it does not require creating host-level Docker networks.
