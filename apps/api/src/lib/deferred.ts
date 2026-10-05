import { logger } from '../logger';

const pending = new Set<Promise<unknown>>();

/**
 * Runs side effects (notifications, alerts) after the response without blocking it.
 * Errors are logged and never propagate to the request.
 */
export function defer(name: string, fn: () => Promise<unknown>): void {
  const task = Promise.resolve()
    .then(fn)
    .catch((err: unknown) => logger.error({ err, task: name }, 'Deferred task failed'))
    .finally(() => pending.delete(task));
  pending.add(task);
}

/** Awaits all deferred tasks. Used by tests and graceful shutdown. */
export async function drainDeferred(): Promise<void> {
  while (pending.size > 0) {
    await Promise.allSettled([...pending]);
  }
}
