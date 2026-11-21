import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiError } from '../../api/client';
import type { RegisterRequest } from '../../api/schema';
import { AuthProvider, useAuth } from './AuthContext';

const session = {
  accessToken: 'new-token',
  expiresIn: 3600,
  user: { id: 'u2', displayName: 'New User', email: 'test@example.com' },
};

const mockGetToken = vi.fn<[], string | null>();
const mockSetToken = vi.fn<[string | null], void>();
const mockMe = vi.fn<[{ silent?: boolean }?], Promise<unknown>>();
const mockLogin = vi.fn<[unknown], Promise<unknown>>();
const mockRegister = vi.fn<[RegisterRequest], Promise<unknown>>();

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  api: {
    getToken: (): string | null => mockGetToken(),
    setToken: (token: string | null) => {
      mockSetToken(token);
    },
  },
}));

vi.mock('../../api/endpoints', () => ({
  authApi: {
    me: (options?: { silent?: boolean }): Promise<unknown> => mockMe(options),
    login: (req: unknown): Promise<unknown> => mockLogin(req),
    register: (req: RegisterRequest): Promise<unknown> => mockRegister(req),
  },
}));

function TestComponent() {
  const { user, isAuthenticated, loading, login, register, logout } = useAuth();

  if (loading) return <div data-testid="loading">Loading...</div>;

  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'Logged In' : 'Logged Out'}</div>
      <div data-testid="user-name">{user?.displayName}</div>
      <button onClick={() => void login('test@example.com', 'pass').catch(() => undefined)}>
        Login
      </button>
      <button
        onClick={() =>
          void register({
            email: 'test@example.com',
            password: 'pass',
            displayName: 'New User',
          }).catch(() => undefined)
        }
      >
        Register
      </button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <TestComponent />
    </AuthProvider>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    mockGetToken.mockReset();
    mockSetToken.mockReset();
    mockMe.mockReset();
    mockLogin.mockReset();
    mockRegister.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes as logged out if no token exists', () => {
    mockGetToken.mockReturnValue(null);
    renderProvider();
    expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged Out');
  });

  it('fetches profile and logs in if valid token exists', async () => {
    mockGetToken.mockReturnValue('valid-token');
    mockMe.mockResolvedValue({ id: 'u1', displayName: 'Test User' });

    renderProvider();

    expect(screen.getByTestId('loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged In');
      expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
    });
  });

  it('restores the session silently and clears the token when the stored token is rejected (expired or tampered)', async () => {
    mockGetToken.mockReturnValue('tampered-token');
    mockMe.mockRejectedValue(new ApiError(401, ['Unauthorized']));

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged Out');
    });
    expect(mockSetToken).toHaveBeenCalledWith(null);
    // silent: a stale session at page load must not show an error toast
    expect(mockMe).toHaveBeenCalledWith({ silent: true });
  });

  it('ignores a stale profile response from a superseded restore (unmount guard)', async () => {
    mockGetToken.mockReturnValue('valid-token');
    const resolvers: Array<(profile: unknown) => void> = [];
    mockMe.mockImplementation(() => new Promise((resolve) => resolvers.push(resolve)));

    // StrictMode mounts the effect twice: the first request is cancelled by the cleanup
    render(
      <StrictMode>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </StrictMode>
    );
    expect(resolvers).toHaveLength(2);

    resolvers[1]({ id: 'u1', displayName: 'Current User' });
    await waitFor(() => expect(screen.getByTestId('user-name')).toHaveTextContent('Current User'));
    resolvers[0]({ id: 'u0', displayName: 'Stale User' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByTestId('user-name')).toHaveTextContent('Current User');
  });

  it('allows user to login', async () => {
    mockGetToken.mockReturnValue(null);
    mockLogin.mockResolvedValue(session);

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged Out'));

    await userEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged In');
      expect(screen.getByTestId('user-name')).toHaveTextContent('New User');
    });
    expect(mockSetToken).toHaveBeenCalledWith('new-token');
  });

  it('stays logged out and stores no token when login fails', async () => {
    mockGetToken.mockReturnValue(null);
    mockLogin.mockRejectedValue(new ApiError(401, ['Invalid credentials']));

    renderProvider();
    await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged Out'));

    await userEvent.click(screen.getByText('Login'));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged Out');
    expect(mockSetToken).not.toHaveBeenCalled();
  });

  it('registers and starts a session with the returned token and user', async () => {
    mockGetToken.mockReturnValue(null);
    mockRegister.mockResolvedValue(session);

    renderProvider();
    await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged Out'));

    await userEvent.click(screen.getByText('Register'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged In');
      expect(screen.getByTestId('user-name')).toHaveTextContent('New User');
    });
    expect(mockRegister).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'pass',
      displayName: 'New User',
    });
    expect(mockSetToken).toHaveBeenCalledWith('new-token');
  });

  it('allows user to logout', async () => {
    mockGetToken.mockReturnValue('valid-token');
    mockMe.mockResolvedValue({ id: 'u1', displayName: 'Test User' });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged In'));

    await userEvent.click(screen.getByText('Logout'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged Out');
    });
    expect(mockSetToken).toHaveBeenCalledWith(null);
  });
});
