const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export function validateEmail(value: string): string | undefined {
  const email = value.trim();
  if (!email) return 'Email is required';
  if (!EMAIL_PATTERN.test(email)) return 'Enter a valid email address';
  return undefined;
}

export function validatePassword(value: string): string | undefined {
  if (!value) return 'Password is required';
  if (value.length < 8) return 'Password must be at least 8 characters';
  if (value.length > 72) return 'Password must be at most 72 characters';
  return undefined;
}

export function validateDisplayName(value: string): string | undefined {
  const name = value.trim();
  if (!name) return 'Display name is required';
  if (name.length > 100) return 'Display name must be at most 100 characters';
  return undefined;
}

export type LoginField = 'email' | 'password';
export type RegisterField = 'displayName' | 'email' | 'password' | 'confirmPassword';

export function validateLogin(values: { email: string; password: string }): FieldErrors<LoginField> {
  const errors: FieldErrors<LoginField> = {};
  const email = validateEmail(values.email);
  if (email) errors.email = email;
  if (!values.password) errors.password = 'Password is required';
  return errors;
}

export function validateRegister(values: {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
}): FieldErrors<RegisterField> {
  const errors: FieldErrors<RegisterField> = {};
  const displayName = validateDisplayName(values.displayName);
  const email = validateEmail(values.email);
  const password = validatePassword(values.password);
  if (displayName) errors.displayName = displayName;
  if (email) errors.email = email;
  if (password) errors.password = password;
  if (!password && values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }
  return errors;
}
