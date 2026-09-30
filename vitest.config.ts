import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// engine/ is pure (no I/O, no Prisma) and carries co-located *.test.ts, the repo convention: the
// POSH rules (what a valid edit is, how a record's status is derived) and who may edit what.
// tests/ holds the write-path checks with Prisma mocked at the @/lib/db seam.
export default defineConfig({
  test: {
    include: ['engine/**/*.test.ts', 'lib/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
});
