// Central REST API base URL configuration for the Node/Express backend.
// Override with VITE_API_BASE_URL (e.g. in .env.local) for local development;
// otherwise defaults to the deployed production API origin.
const DEFAULT_API_BASE_URL = 'https://jdwd40.com/api-2/api';

// Pure resolver, exported for focused contract tests: a blank/absent override
// falls back to the default; a configured value is trimmed and any trailing
// slashes are removed so endpoint paths always join cleanly.
export function resolveApiBaseUrl(configured: unknown): string {
  return typeof configured === 'string' && configured.trim().length > 0
    ? configured.trim().replace(/[/]+$/u, '')
    : DEFAULT_API_BASE_URL;
}

// import.meta.env only exists under Vite; the optional-chain keeps this module
// loadable by plain Node (unit tests run via node --test).
export const API_BASE_URL: string = resolveApiBaseUrl(import.meta.env?.VITE_API_BASE_URL);
