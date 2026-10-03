const TOKEN_KEY = 'accessToken';

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export const tokenStorage = {
  get(): string | null {
    return storage()?.getItem(TOKEN_KEY) ?? null;
  },
  set(token: string): void {
    storage()?.setItem(TOKEN_KEY, token);
  },
  clear(): void {
    storage()?.removeItem(TOKEN_KEY);
  },
};
