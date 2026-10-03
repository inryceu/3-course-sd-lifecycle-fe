import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { validateRegister } from './validation';
import type { FieldErrors, RegisterField } from './validation';
import { ApiError } from '../../api/client';

export function RegisterPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<RegisterField>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const errors = validateRegister({ displayName, email, password, confirmPassword });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      await register({ email: email.trim(), password, displayName: displayName.trim() });
      navigate('/boards', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const field = (
    id: RegisterField,
    label: string,
    value: string,
    onChange: (value: string) => void,
    type: string,
    autoComplete: string
  ) => (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
        autoComplete={autoComplete}
        disabled={loading}
        aria-invalid={!!fieldErrors[id]}
        aria-describedby={fieldErrors[id] ? `${id}-error` : undefined}
      />
      {fieldErrors[id] && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600">
          {fieldErrors[id]}
        </p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full card p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">BoardSync</h1>
          <p className="text-gray-600 mt-2">Create your account</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
          {field('displayName', 'Display name', displayName, setDisplayName, 'text', 'name')}
          {field('email', 'Email', email, setEmail, 'email', 'email')}
          {field('password', 'Password', password, setPassword, 'password', 'new-password')}
          {field(
            'confirmPassword',
            'Confirm password',
            confirmPassword,
            setConfirmPassword,
            'password',
            'new-password'
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
