// Docker Hub pull count. Best effort: a failure is a warning, never a failed run.

import type { Client } from './client';
import type { Logger } from '../types';

/** Pulls of `namespace/name`, or undefined (after a warning) when Docker Hub doesn't answer. */
export async function fetchDockerPulls(api: Client, image: string, log: Logger): Promise<number | undefined> {
  try {
    const info = await api<{ pull_count: number }>(`/v2/repositories/${image}/`);
    return info.pull_count;
  } catch (error) {
    log.warning(`docker hub: ${image} pulls not collected (${(error as Error).message})`);
    return undefined;
  }
}
