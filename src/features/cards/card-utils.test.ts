import { describe, it, expect } from 'vitest';
import { errorMessage, textOn, toDateInput, toDeadlineIso } from './card-utils';

describe('deadline date helpers', () => {
  it('shows the stored UTC date and nothing for an empty deadline', () => {
    expect(toDateInput('2026-11-01T00:00:00.000Z')).toBe('2026-11-01');
    expect(toDateInput(null)).toBe('');
    expect(toDateInput(undefined)).toBe('');
  });

  it('stores a picked date as UTC midnight and an empty field as no deadline', () => {
    expect(toDeadlineIso('2026-11-01')).toBe('2026-11-01T00:00:00.000Z');
    expect(toDeadlineIso('')).toBeNull();
  });
});

describe('errorMessage', () => {
  it('uses the message of an Error and a generic text otherwise', () => {
    expect(errorMessage(new Error('Boom'))).toBe('Boom');
    expect(errorMessage(new Error(''))).toBe('Request failed');
    expect(errorMessage('plain string')).toBe('Request failed');
    expect(errorMessage(undefined)).toBe('Request failed');
  });
});

describe('textOn', () => {
  it('picks white on dark and black on light backgrounds', () => {
    expect(textOn('#000000')).toBe('#ffffff');
    expect(textOn('#1e3a8a')).toBe('#ffffff');
    expect(textOn('#ffffff')).toBe('#000000');
    expect(textOn('#fde047')).toBe('#000000');
  });

  it('falls back to black for an unparsable colour', () => {
    expect(textOn('not-a-colour')).toBe('#000000');
  });
});
