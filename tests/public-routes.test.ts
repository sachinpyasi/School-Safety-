import { describe, it, expect } from 'vitest';
import { isPublicPath } from '@/lib/auth/public-routes';

describe('isPublicPath', () => {
  it('lets exactly the health probe, the Auth.js endpoints and the login page through', () => {
    expect(isPublicPath('/api/health')).toBe(true);
    expect(isPublicPath('/api/auth/callback/google')).toBe(true);
    expect(isPublicPath('/api/auth/csrf')).toBe(true);
    expect(isPublicPath('/login')).toBe(true);
  });

  it('keeps every page, the CSV export and the logout page behind sign-in', () => {
    for (const p of ['/', '/posh', '/posh/export', '/rights', '/activity', '/logout']) {
      expect(isPublicPath(p), p).toBe(false);
    }
  });

  it('does not let a near-miss inherit the health exemption', () => {
    expect(isPublicPath('/api/healthz')).toBe(false);
    expect(isPublicPath('/api/health/posh')).toBe(false);
    expect(isPublicPath('/login/anything')).toBe(false);
  });
});
