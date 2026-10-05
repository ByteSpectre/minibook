import { execSync } from 'node:child_process';
import path from 'node:path';

/** Recreates the test database schema from migrations once per run. */
export default function setup(): void {
  const url =
    process.env.TEST_DATABASE_URL ?? 'postgresql://beauty:beauty@localhost:5432/beauty_test';
  const cwd = path.resolve(__dirname, '..');
  const env = { ...process.env, DATABASE_URL: url };
  execSync('npx prisma db execute --stdin', {
    cwd,
    env,
    input: 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;',
    stdio: ['pipe', 'ignore', 'inherit'],
  });
  execSync('npx prisma migrate deploy', { cwd, env, stdio: ['ignore', 'ignore', 'inherit'] });
}
