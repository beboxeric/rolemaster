// Tiny session-aware fetch wrapper. Two auth sources, in priority order:
//   1. Per-tab JWT in sessionStorage (key TOKEN_KEY) — sent as `Authorization:
//      Bearer <jwt>`. Lets the same browser run two different accounts in
//      two tabs (curator + supplier) without one clobbering the other.
//   2. The rm_token cookie — default fallback for fresh tabs and refreshes.

const BASE = '/api';
const TOKEN_KEY = 'rm_session_token';

export function setSessionToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {}
}
export function getSessionToken() {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}

async function request(method, path, body, opts = {}) {
  const headers = { 'Accept': 'application/json' };
  // Per-tab JWT (set on login/register). The cookie still rides along for
  // fresh tabs, but the Bearer header takes precedence on the server.
  const tabToken = getSessionToken();
  if (tabToken) headers['Authorization'] = `Bearer ${tabToken}`;
  // Superadmin "View as partner" — auto-attach impersonation header.
  // Stored in sessionStorage (per-tab) so the original curator tab is
  // unaffected. Bypassed for /auth/me + /admin/* + /curator/* so meta +
  // admin views always reflect the real user.
  try {
    const imp = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('rm_impersonate_supplier_id') : null;
    if (imp && !path.startsWith('/auth/me') && !path.startsWith('/admin/') && !path.startsWith('/curator/')) {
      headers['X-Impersonate-Supplier'] = imp;
    }
  } catch {}
  let payload;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: payload,
    credentials: 'include',
    ...opts,
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch {
      // Non-JSON body (HTML error page from CDN, auth redirect, 5xx).
      // Build a clean Error so callers don't see "Unexpected token '<'".
      const looksLikeHtml = /^\s*<!doctype|<html/i.test(text);
      const msg = looksLikeHtml
        ? `Server returned HTML (HTTP ${res.status}). Likely auth lost or endpoint missing.`
        : `Bad response (HTTP ${res.status}): ${text.slice(0, 80)}`;
      const err = new Error(msg);
      err.status = res.status;
      err.body = text;
      throw err;
    }
  }
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, body) => request('POST', p, body),
  put: (p, body) => request('PUT', p, body),
  patch: (p, body) => request('PATCH', p, body),
  delete: (p) => request('DELETE', p),
  upload: (p, formData) => request('POST', p, formData),
};

// Convenience wrappers for the routes we hit a lot.
export const auth = {
  me: () => api.get('/auth/me'),
  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res?.token) setSessionToken(res.token);
    return res;
  },
  register: async (payload) => {
    const res = await api.post('/auth/register', payload);
    if (res?.token) setSessionToken(res.token);
    return res;
  },
  logout: async () => {
    try { return await api.post('/auth/logout'); }
    finally { setSessionToken(null); }
  },
};

export const curator = {
  listIntakes: (status = 'submitted') => api.get(`/curator/intakes?status=${status}`),
  publishRolepack: (rpId, body) => api.post(`/curator/rolepacks/${rpId}/publish`, body || {}),
  publishAll: (intakeId, body) => api.post(`/curator/intakes/${intakeId}/publish-all`, body || {}),
  generateSummary: (intakeId) => api.post(`/curator/intakes/${intakeId}/summary`, {}),
  rewriteAi: (intakeId, body) => api.post(`/curator/intakes/${intakeId}/ai/rewrite`, body || {}),
  seedSummaries: () => api.get('/curator/seed-summaries'),
  listSuppliers: () => api.get('/curator/suppliers'),
  getSupplier: (supplierId) => api.get(`/curator/suppliers/${supplierId}`),
  patchSupplier: (supplierId, body) => api.patch(`/curator/suppliers/${supplierId}`, body),
  // Curator-only library of every published rolepack (with star state).
  listPublishedRolepacks: () => api.get('/curator/rolepacks'),
  // Toggle a rolepack's `is_featured` flag (controls landing-page hero).
  toggleRolepackFeature: (rpId, featured) => api.post(`/curator/rolepacks/${rpId}/feature`, { featured: !!featured }),
  // Pull a published rolepack back into review (clears is_featured + flips
  // intake.is_published if no sibling stays live).
  unpublishRolepack: (rpId) => api.post(`/curator/rolepacks/${rpId}/unpublish`, {}),
  // Persist drag-drop order from the library; ids[] is the new top-to-bottom
  // sequence. Both the curator library and the public catalogue ORDER BY it.
  reorderRolepacks: (ids) => api.post('/curator/rolepacks/reorder', { ids }),
  // Replace a published rolepack's industries with the canonical cat_*
  // parents the curator selects. Server validates each value against the
  // 13 known cats; values outside the set are dropped silently.
  updateRolepackIndustries: (rpId, industries) =>
    api.put(`/curator/rolepacks/${rpId}/industries`, { industries }),
};

export const sales = {
  listRolepacks: () => api.get('/sales/rolepacks'),
  getRolepack: (rpId) => api.get(`/sales/rolepacks/${rpId}`),
};

// Public, no-auth endpoints — used by the marketing landing at
// airolemaster.com to render the live catalogue.
export const publicApi = {
  rolepacks: () => api.get('/public/rolepacks'),
  // Curator-starred subset that powers the landing-page hero catalogue.
  featuredRolepacks: () => api.get('/public/rolepacks?featured=1'),
};

export const companyInfo = {
  get: () => api.get('/suppliers/me/company-info'),
  patch: (updates) => api.patch('/suppliers/me/company-info', { updates }),
};

// Admin / superadmin user management
export const admin = {
  listUsers: () => api.get('/admin/users'),
  createUser: (body) => api.post('/admin/users', body),
  updateUser: (userId, body) => api.patch(`/admin/users/${userId}`, body),
  deleteUser: (userId) => api.delete(`/admin/users/${userId}`),
  listSuppliersLite: () => api.get('/curator/suppliers'),
};

// Lightweight curator directory — any logged-in curator can read it. Used by
// the kanban to populate the assign-curator menu so a brand-new curator
// account becomes assignable as soon as it's created.
export const curators = {
  list: () => api.get('/curator/curators'),
};

// T5.3
export const notifications = {
  list: () => api.get('/notifications'),
  unread: () => api.get('/notifications?unread=1'),
  markRead: (ids) => api.post('/notifications/mark-read', { ids: ids || [] }),
};

import { mergeIndustriesWithFallback, mergeDepartmentsWithFallback } from './taxonomy-fallback.js';

// Taxonomies. industries()/departments() merge a hardcoded fallback into the
// API response so labels never fall through to raw English IDs (e.g. `retail`,
// `fnb`) when the API is empty/unreachable. API entries win — curators can
// still rename via the admin endpoint.
export const taxonomy = {
  industries: async () => {
    try {
      const r = await api.get('/taxonomy/industries');
      return { items: mergeIndustriesWithFallback(r?.items || []) };
    } catch {
      return { items: mergeIndustriesWithFallback([]) };
    }
  },
  createIndustry: (body) => api.post('/taxonomy/industries', body),
  patchIndustry: (id, body) => api.patch(`/taxonomy/industries/${id}`, body),
  deleteIndustry: (id) => api.delete(`/taxonomy/industries/${id}`),
  regions: () => api.get('/taxonomy/regions'),
  departments: async () => {
    try {
      const r = await api.get('/taxonomy/departments');
      return { items: mergeDepartmentsWithFallback(r?.items || []) };
    } catch {
      return { items: mergeDepartmentsWithFallback([]) };
    }
  },
  companySizes: () => api.get('/taxonomy/company-sizes'),
};

// v2 — intake-based supplier flow
export const intakes = {
  list: () => api.get('/intakes'),
  create: (body) => api.post('/intakes', body || {}),
  get: (id) => api.get(`/intakes/${id}`),
  patch: (id, body) => api.patch(`/intakes/${id}`, body),
  remove: (id) => api.delete(`/intakes/${id}`),
  uploadFile: (id, formData) => api.upload(`/intakes/${id}/files`, formData),
  listFiles: (id) => api.get(`/intakes/${id}/files`),
  renameFile: (id, fid, display_name) => api.patch(`/intakes/${id}/files/${fid}`, { display_name }),
  deleteFile: (id, fid) => api.delete(`/intakes/${id}/files/${fid}`),
  fileDownloadUrl: (id, fid) => `/api/intakes/${id}/files/${fid}`,
  extractCapabilities: (id) => api.post(`/intakes/${id}/extract-capabilities`),
  // Used by both curator and supplier (route is open to either when supplier owns the intake).
  aiRewrite: (id, body) => api.post(`/curator/intakes/${id}/ai/rewrite`, body || {}),
  matchRoles: (id) => api.post(`/intakes/${id}/match-roles`),
  finalize: (id) => api.post(`/intakes/${id}/finalize`),
  // capabilities
  addCapability: (id, body) => api.post(`/intakes/${id}/capabilities`, body),
  patchCapabilities: (id, body) => api.patch(`/intakes/${id}/capabilities`, body),
  patchCapability: (id, capId, body) => api.patch(`/intakes/${id}/capabilities/${capId}`, body),
  deleteCapability: (id, capId) => api.delete(`/intakes/${id}/capabilities/${capId}`),
  confirmCapabilities: (id) => api.patch(`/intakes/${id}/capabilities`, { confirm_all: true }),
  // rolepacks
  addRolepack: (id, body) => api.post(`/intakes/${id}/rolepacks`, body),
  patchRolepack: (id, rpId, body) => api.patch(`/intakes/${id}/rolepacks/${rpId}`, body),
  deleteRolepack: (id, rpId) => api.delete(`/intakes/${id}/rolepacks/${rpId}`),
  prefillRolepack: (id, rpId, force) => api.post(`/intakes/${id}/rolepacks/${rpId}/prefill${force ? '?force=1' : ''}`),
  generateRolepack: (id, rpId, force) => api.post(`/intakes/${id}/rolepacks/${rpId}/generate${force ? '?force=1' : ''}`),
  rolepackCopilot: (id, rpId, message, opts = {}) => api.post(`/intakes/${id}/rolepacks/${rpId}/copilot`, { message, dryrun: !!opts.dryrun }),
  rolepackCopilotHistory: (id, rpId) => api.get(`/intakes/${id}/rolepacks/${rpId}/copilot`),
};
