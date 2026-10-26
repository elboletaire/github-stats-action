import { describe, expect, it } from 'vitest';
import { counterNote } from '../src/sections/kpis';

describe('counterNote', () => {
  const counter = { name: 'updates', label: 'In-app updates', assets: '*-update.json' };

  it('is absent for a counter with neither a start version nor a per-user figure', () => {
    expect(counterNote(counter)).toBeUndefined();
  });

  it('says where the count starts', () => {
    expect(counterNote({ ...counter, from: 'v1.19.0' })).toBe('Counted from v1.19.0');
  });

  it('adds the increase per daily user, approximate and over 30 days', () => {
    expect(counterNote({ ...counter, perUser: 0.4215 })).toBe('≈ 0.42 per daily user, last 30 days');
    expect(counterNote({ ...counter, from: 'v1.19.0', perUser: 0.4215 })).toBe(
      'Counted from v1.19.0. ≈ 0.42 per daily user, last 30 days',
    );
  });
});
