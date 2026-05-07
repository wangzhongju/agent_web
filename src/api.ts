import type {OrganizationRecord, ProjectRecord, SessionDetail, SessionRecord, UploadedAttachment} from './types';

const API_BASE = import.meta.env.VITE_OPENHARNESS_API_BASE ?? '';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function listOrganizations() {
  return requestJson<OrganizationRecord[]>('/api/orgs');
}

export function authSession() {
  return requestJson<{authenticated: boolean; login_url?: string; user?: Record<string, unknown>}>('/api/auth/session');
}

export function logout() {
  return fetch(`${API_BASE}/api/auth/logout`, {method: 'POST', credentials: 'include'});
}

export function listProjects(organizationId?: string) {
  const query = organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : '';
  return requestJson<ProjectRecord[]>(`/api/projects${query}`);
}

export function listSessions(projectId?: string) {
  const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
  return requestJson<SessionRecord[]>(`/api/sessions${query}`);
}

export function createSession(organizationId: string, projectId: string, title = 'New chat') {
  return requestJson<SessionRecord>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({organization_id: organizationId, project_id: projectId, title}),
  });
}

export function updateSession(sessionId: string, update: {title?: string; pinned?: boolean}) {
  return requestJson<SessionRecord>(`/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    body: JSON.stringify(update),
  });
}

export function deleteSession(sessionId: string) {
  return requestJson<{ok: boolean}>(`/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
}

export function getSession(sessionId: string) {
  return requestJson<SessionDetail>(`/api/sessions/${encodeURIComponent(sessionId)}`);
}

export async function uploadSessionAttachments(sessionId: string, files: File[]) {
  const form = new FormData();
  for (const file of files) {
    form.append('files', file);
  }
  const response = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(sessionId)}/attachments`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<{attachments: UploadedAttachment[]}>;
}

export function runtimeStatus(projectId: string) {
  return requestJson<Record<string, unknown>>(`/api/projects/${encodeURIComponent(projectId)}/runtime-status`);
}

export function webSocketUrl(sessionId: string) {
  const base = API_BASE || window.location.origin;
  const url = new URL(base, window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `/api/ws/sessions/${encodeURIComponent(sessionId)}`;
  url.search = '';
  return url.toString();
}

export function newRequestId() {
  return `req_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}
