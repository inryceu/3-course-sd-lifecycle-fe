import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { api } from '../../api/client';
import { authApi } from '../../api/endpoints';

vi.mock('../../api/client', () => ({
  api: {
    getToken: vi.fn(),
    setToken: vi.fn(),
  },
}));

vi.mock('../../api/endpoints', () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
  },
}));

function TestComponent() {
  const { user, isAuthenticated, loading, login, logout } = useAuth();

  if (loading) return <div data-testid="loading">Loading...</div>;

  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'Logged In' : 'Logged Out'}</div>
      <div data-testid="user-name">{user?.displayName}</div>
      <button onClick={() => login('test@example.com', 'pass')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes as logged out if no token exists', async () => {
    (api.getToken as any).mockReturnValue(null);
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged Out');
  });

  it('fetches profile and logs in if valid token exists', async () => {
    (api.getToken as any).mockReturnValue('valid-token');
    (authApi.me as any).mockResolvedValue({ id: 'u1', displayName: 'Test User' });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged In');
      expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
    });
  });

  it('clears token if fetching profile fails (edge case: expired/tampered token)', async () => {
    (api.getToken as any).mockReturnValue('tampered-token');
    (authApi.me as any).mockRejectedValue(new Error('Unauthorized'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged Out');
    });
    expect(api.setToken).toHaveBeenCalledWith(null);
  });

  it('allows user to login', async () => {
    (api.getToken as any).mockReturnValue(null);
    (authApi.login as any).mockResolvedValue({
      accessToken: 'new-token',
      user: { id: 'u2', displayName: 'New User' },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged Out'));

    await userEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged In');
      expect(screen.getByTestId('user-name')).toHaveTextContent('New User');
    });
    expect(api.setToken).toHaveBeenCalledWith('new-token');
  });

  it('allows user to logout', async () => {
    (api.getToken as any).mockReturnValue('valid-token');
    (authApi.me as any).mockResolvedValue({ id: 'u1', displayName: 'Test User' });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged In'));

    await userEvent.click(screen.getByText('Logout'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged Out');
    });
    expect(api.setToken).toHaveBeenCalledWith(null);
  });
});
