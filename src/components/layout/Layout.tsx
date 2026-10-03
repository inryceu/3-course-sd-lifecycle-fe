import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth';
import { Toaster } from 'react-hot-toast';

export function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();

  const navigation = [
    { name: 'Boards', href: '/boards', icon: '📋' },
    { name: 'Jira Sync', href: '/jira-sync', icon: '🔄' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="Global">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Link to="/boards" className="flex items-center space-x-2">
                <span className="text-2xl">📋</span>
                <span className="text-xl font-bold text-gray-900">BoardSync</span>
              </Link>
            </div>

            <div className="hidden md:flex md:items-center md:space-x-4">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname.startsWith(item.href)
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              ))}
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex sm:items-center space-x-3">
                <span className="text-sm text-gray-700">{user?.displayName}</span>
                <button onClick={logout} className="btn-secondary text-sm">
                  Log out
                </button>
              </div>
            </div>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Toaster position="top-right" />
        <Outlet />
      </main>
    </div>
  );
}
