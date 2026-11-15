import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

const mockGetToken = vi.fn();
const mockSetToken = vi.fn();
const mockMe = vi.fn();
const mockLogin = vi.fn();

vi.mock('../../api/client', () => ({
  api: {
    getToken: () => mockGetToken(),
    setToken: (token: string | null) => {
      mockSetToken(token);
    },
  },
}));

vi.mock('../../api/endpoints', () => ({
  authApi: {
    me: () => mockMe(),
    login: (req: unknown) => mockLogin(req),
    register: () => {},
  },
}));

function TestComponent() {
  const { user, isAuthenticated, loading, login, logout } = useAuth();

  if (loading) return <div data-testid="loading">Loading...</div>;

  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'Logged In' : 'Logged Out'}</div>
      <div data-testid="user-name">{user?.displayName}</div>
      <button onClick={() => void login('test@example.com', 'pass')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    mockGetToken.mockReset();
    mockSetToken.mockReset();
    mockMe.mockReset();
    mockLogin.mockReset();
  });

  it('initializes as logged out if no token exists', () => {
    mockGetToken.mockReturnValue(null);
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged Out');
  });

  it('fetches profile and logs in if valid token exists', async () => {
    mockGetToken.mockReturnValue('valid-token');
    mockMe.mockResolvedValue({ id: 'u1', displayName: 'Test User' });

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
    mockGetToken.mockReturnValue('tampered-token');
    mockMe.mockRejectedValue(new Error('Unauthorized'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged Out');
    });
    expect(mockSetToken).toHaveBeenCalledWith(null);
  });

  it('allows user to login', async () => {
    mockGetToken.mockReturnValue(null);
    mockLogin.mockResolvedValue({
      accessToken: 'new-token',
      expiresIn: 3600,
      user: { id: 'u2', displayName: 'New User', email: 'test@example.com' },
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
    expect(mockSetToken).toHaveBeenCalledWith('new-token');
  });

  it('allows user to logout', async () => {
    mockGetToken.mockReturnValue('valid-token');
    mockMe.mockResolvedValue({ id: 'u1', displayName: 'Test User' });

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
    expect(mockSetToken).toHaveBeenCalledWith(null);
  });
});
