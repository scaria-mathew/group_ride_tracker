/**
 * REST API client helpers
 */
const API_BASE = '/api';

export async function checkServerHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return await res.json();
  } catch (err) {
    console.error('API health check error:', err);
    return { status: 'error', message: err.message };
  }
}
