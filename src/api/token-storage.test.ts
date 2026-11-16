import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tokenStorage } from './token-storage';

describe('tokenStorage', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('gets, sets, and clears tokens correctly', () => {
    expect(tokenStorage.get()).toBeNull();

    tokenStorage.set('my-test-token');
    expect(tokenStorage.get()).toBe('my-test-token');

    tokenStorage.clear();
    expect(tokenStorage.get()).toBeNull();
  });

  it('handles storage errors gracefully (e.g., incognito mode constraints)', () => {
    const storageMock = vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new Error('Access denied');
    });

    expect(tokenStorage.get()).toBeNull();
    expect(() => tokenStorage.set('token')).not.toThrow();
    expect(() => tokenStorage.clear()).not.toThrow();

    storageMock.mockRestore();
  });
});
