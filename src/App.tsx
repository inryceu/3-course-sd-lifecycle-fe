import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, LoginPage, RegisterPage } from './features/auth';
import { Layout } from './components/layout/Layout';
import { BoardsPage, BoardPage } from './features/boards';
import { JiraSyncPage } from './features/jira-sync';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/boards" replace /> : <LoginPage />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/boards" replace /> : <RegisterPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/boards" element={<BoardsPage />} />
        <Route path="/boards/:boardId" element={<BoardPage />} />
        <Route path="/jira-sync" element={<JiraSyncPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/boards" replace />} />
      <Route path="*" element={<Navigate to="/boards" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;