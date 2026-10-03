import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';
import { ApiError } from '../../api/client';
import { renderWithRouter } from '../../test-utils';

const login = vi.fn();
const register = vi.fn();

vi.mock('./AuthContext', () => ({
  useAuth: () => ({ login, register }),
}));

function routes(page: JSX.Element, path: string) {
  return (
    <Routes>
      <Route path={path} element={page} />
      <Route path="/boards" element={<p>Boards page</p>} />
    </Routes>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    login.mockReset();
  });

  it('shows client-side validation errors and does not call the API', async () => {
    renderWithRouter(routes(<LoginPage />, '/login'), '/login');

    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('logs in and navigates to the boards page', async () => {
    login.mockResolvedValueOnce(undefined);
    renderWithRouter(routes(<LoginPage />, '/login'), '/login');

    await userEvent.type(screen.getByLabelText('Email'), 'user@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'secret-pass');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(screen.getByText('Boards page')).toBeInTheDocument());
    expect(login).toHaveBeenCalledWith('user@example.com', 'secret-pass');
  });

  it('shows the server error', async () => {
    login.mockRejectedValueOnce(new ApiError(401, ['Invalid credentials']));
    renderWithRouter(routes(<LoginPage />, '/login'), '/login');

    await userEvent.type(screen.getByLabelText('Email'), 'user@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-pass');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
    expect(screen.queryByText('Boards page')).not.toBeInTheDocument();
  });
});

describe('RegisterPage', () => {
  beforeEach(() => {
    register.mockReset();
  });

  async function fill(values: {
    name?: string;
    email?: string;
    password?: string;
    confirm?: string;
  }) {
    if (values.name) await userEvent.type(screen.getByLabelText('Display name'), values.name);
    if (values.email) await userEvent.type(screen.getByLabelText('Email'), values.email);
    if (values.password) await userEvent.type(screen.getByLabelText('Password'), values.password);
    if (values.confirm) {
      await userEvent.type(screen.getByLabelText('Confirm password'), values.confirm);
    }
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  }

  it('validates name, email and password length', async () => {
    renderWithRouter(routes(<RegisterPage />, '/register'), '/register');

    await fill({ email: 'bad', password: 'short' });

    expect(screen.getByText('Display name is required')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('rejects mismatching passwords', async () => {
    renderWithRouter(routes(<RegisterPage />, '/register'), '/register');

    await fill({ name: 'Ann', email: 'ann@example.com', password: 'password1', confirm: 'password2' });

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('registers and navigates to the boards page', async () => {
    register.mockResolvedValueOnce(undefined);
    renderWithRouter(routes(<RegisterPage />, '/register'), '/register');

    await fill({ name: ' Ann ', email: 'ann@example.com', password: 'password1', confirm: 'password1' });

    await waitFor(() => expect(screen.getByText('Boards page')).toBeInTheDocument());
    expect(register).toHaveBeenCalledWith({
      email: 'ann@example.com',
      password: 'password1',
      displayName: 'Ann',
    });
  });

  it('shows the server error for a duplicate e-mail', async () => {
    register.mockRejectedValueOnce(new ApiError(409, ['Email already registered']));
    renderWithRouter(routes(<RegisterPage />, '/register'), '/register');

    await fill({ name: 'Ann', email: 'ann@example.com', password: 'password1', confirm: 'password1' });

    expect(await screen.findByRole('alert')).toHaveTextContent('Email already registered');
  });
});
