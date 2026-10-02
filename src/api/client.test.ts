import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from './client';
import toast from 'react-hot-toast';

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
  },
}));

describe('ApiClient Interceptor & Error Handling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should automatically attach Authorization header if token exists', async () => {
    const mockToken = 'test-jwt-token';
    api.setToken(mockToken);

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    } as Response);

    await api.get('/test-endpoint');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test-endpoint'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${mockToken}`,
        }),
      })
    );
  });

  it('should trigger toast.error on non-2xx HTTP responses', async () => {
    api.setToken(null);

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'Internal Server Error' }),
    } as Response);

    await expect(api.get('/error-endpoint')).rejects.toThrow('Internal Server Error');
    expect(toast.error).toHaveBeenCalledWith('Internal Server Error');
  });

  it('should clear token and redirect on 401 Unauthorized', async () => {
    api.setToken('expired-token');

    const removeItemSpy = vi.spyOn(localStorage, 'removeItem');
    const locationMock = { href: '' };
    vi.stubGlobal('location', locationMock);

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response);

    await expect(api.get('/protected-endpoint')).rejects.toThrow('Unauthorized');

    expect(removeItemSpy).toHaveBeenCalledWith('accessToken');
    expect(locationMock.href).toBe('/login');
  });
});
