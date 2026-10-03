import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { renderWithRouter } from '../../test-utils';

const auth = { isAuthenticated: false, loading: false };

vi.mock('../../features/auth', () => ({
  useAuth: () => auth,
}));

function app() {
  return (
    <Routes>
      <Route path="/login" element={<p>Login page</p>} />
      <Route
        path="/boards"
        element={
          <ProtectedRoute>
            <p>Secret boards</p>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to /login', () => {
    auth.isAuthenticated = false;
    auth.loading = false;
    renderWithRouter(app(), '/boards');

    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Secret boards')).not.toBeInTheDocument();
  });

  it('renders children for authenticated users', () => {
    auth.isAuthenticated = true;
    renderWithRouter(app(), '/boards');

    expect(screen.getByText('Secret boards')).toBeInTheDocument();
  });

  it('shows a loading state while the session is restored', () => {
    auth.isAuthenticated = false;
    auth.loading = true;
    renderWithRouter(app(), '/boards');

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });
});
