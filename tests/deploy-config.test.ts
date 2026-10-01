/**
 * How Render runs the app (render.yaml, Dockerfile, scripts/start.sh). Read as text: a wrong field
 * here does not fail any other test, it fails the deploy, hours later and out of sight.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const blueprint = read('render.yaml');
const dockerfile = read('Dockerfile');
const start = read('scripts/start.sh');

/** `key: value` at the service's own indentation, comments stripped. */
function field(name: string): string | undefined {
  const m = new RegExp(`^    ${name}: *([^#\\n]*)`, 'm').exec(blueprint);
  return m?.[1].trim();
}

describe('render.yaml', () => {
  it('is one free Docker web service in Singapore, deploying every push to main', () => {
    expect(blueprint.match(/^  - type: /gm)).toHaveLength(1);
    expect(blueprint).toMatch(/^  - type: web$/m);
    expect(field('runtime')).toBe('docker');
    expect(field('dockerfilePath')).toBe('./Dockerfile');
    expect(field('plan')).toBe('free');
    expect(field('region')).toBe('singapore');
    expect(field('branch')).toBe('main');
    expect(field('autoDeployTrigger')).toBe('commit');
    expect(field('autoDeploy')).toBeUndefined(); // the deprecated spelling
  });

  it('checks the public health route', () => {
    expect(field('healthCheckPath')).toBe('/api/health');
  });

  it('asks for exactly the six settings, and holds no secret itself', () => {
    const keys = [...blueprint.matchAll(/^      - key: (\S+)$/gm)].map((m) => m[1]);
    expect(keys.sort()).toEqual(['AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET', 'AUTH_SECRET', 'AUTH_URL', 'DATABASE_URL', 'RIGHTS_ADMIN_EMAILS']);
    for (const k of ['DATABASE_URL', 'AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET', 'AUTH_URL']) {
      expect(blueprint, k).toMatch(new RegExp(`- key: ${k}\\n {8}sync: false`));
    }
    expect(blueprint).toMatch(/- key: AUTH_SECRET\n {8}generateValue: true/);
    expect(blueprint).not.toMatch(/postgres(ql)?:\/\//);
  });
});

describe('start-up', () => {
  it('the image starts through scripts/start.sh', () => {
    expect(dockerfile).toMatch(/^CMD \["sh", "scripts\/start.sh"\]$/m);
  });

  it('updates the database before serving, and serves on Render\'s PORT', () => {
    const migrate = start.indexOf('prisma migrate deploy');
    const serve = start.indexOf('exec npx next start -H 0.0.0.0 -p "${PORT:-4900}"');
    expect(migrate).toBeGreaterThan(0);
    expect(serve).toBeGreaterThan(migrate);
    expect(start).toMatch(/^set -e$/m);
  });

  it('refuses to start without a database, and warns about Neon\'s pooled address', () => {
    expect(start).toMatch(/if \[ -z "\$DATABASE_URL" \]; then[\s\S]*?exit 1/);
    expect(start).toContain('*-pooler.*)');
  });
});
