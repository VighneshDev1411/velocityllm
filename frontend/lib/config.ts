// Single source of truth for the backend API base URL.
//
// NEXT_PUBLIC_API_URL should be the bare backend origin (e.g. http://localhost:8080).
// Historically some configs set it WITH a trailing /api/v1, which double-prefixed
// requests (…/api/v1/api/v1/auth/login → 404). We normalize here so the app tolerates
// either convention and that class of bug can't recur.
const raw = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').trim();

// Strip any trailing slashes, then a trailing /api/v1 if present.
export const API_ORIGIN = raw.replace(/\/+$/, '').replace(/\/api\/v1$/, '');

// Fully-qualified API base (origin + versioned prefix).
export const API_BASE = `${API_ORIGIN}/api/v1`;
