import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import toast from 'react-hot-toast';
import { api, ApiError } from './client';

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
  },
}));

function respond(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => (body === undefined ? Promise.reject(new Error('no body')) : Promise.resolve(body)),
  } as Response;
}

describe('ApiClient', () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
    api.setToken(null);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('attaches the Authorization header and persists the token in sessionStorage', async () => {
    api.setToken('test-jwt-token');
    vi.mocked(fetch).mockResolvedValueOnce(respond(200, { ok: true }));

    await api.get('/test-endpoint');

    expect(window.sessionStorage.getItem('accessToken')).toBe('test-jwt-token');
    expect(window.localStorage.getItem('accessToken')).toBeNull();
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('/test-endpoint');
    expect((init?.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer test-jwt-token'
    );
  });

  it('shows a toast and throws ApiError on non-2xx responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(respond(500, { message: 'Internal Server Error' }));

    await expect(api.get('/error-endpoint')).rejects.toThrow('Internal Server Error');
    expect(toast.error).toHaveBeenCalledWith('Internal Server Error');
  });

  it('joins validation messages when the backend returns an array', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(respond(400, { message: ['a is bad', 'b is bad'] }));

    const error = await api.post('/x', {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).messages).toEqual(['a is bad', 'b is bad']);
    expect(toast.error).toHaveBeenCalledWith('a is bad\nb is bad');
  });

  it('does not toast when silent is set', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(respond(409, { message: 'Email already registered' }));

    await expect(api.post('/auth/register', {}, { silent: true })).rejects.toThrow(
      'Email already registered'
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('clears the token and redirects to /login on 401 for protected endpoints', async () => {
    api.setToken('expired-token');
    const location = { href: '' };
    vi.stubGlobal('location', location);
    vi.mocked(fetch).mockResolvedValueOnce(respond(401));

    await expect(api.get('/boards')).rejects.toThrow('Unauthorized');

    expect(window.sessionStorage.getItem('accessToken')).toBeNull();
    expect(location.href).toBe('/login');
  });

  it('does not redirect on 401 from the login endpoint', async () => {
    const location = { href: '' };
    vi.stubGlobal('location', location);
    vi.mocked(fetch).mockResolvedValueOnce(respond(401, { message: 'Invalid credentials' }));

    await expect(api.post('/auth/login', {}, { silent: true })).rejects.toThrow(
      'Invalid credentials'
    );
    expect(location.href).toBe('');
  });

  it('returns undefined for 204 responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(respond(204));
    await expect(api.delete('/boards/1')).resolves.toBeUndefined();
  });
});
