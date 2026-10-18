// HTTP clients over up-fetch. The fetch is injected so tests run on fixtures, never the network.

import { up } from 'up-fetch';

export type FetchFn = typeof fetch;

export const USER_AGENT = 'github-stats-action';

export interface ClientOptions {
  fetch: FetchFn;
  baseUrl: string;
  headers?: Record<string, string>;
}

export function createClient(options: ClientOptions) {
  return up(options.fetch, () => ({
    baseUrl: options.baseUrl,
    headers: { 'User-Agent': USER_AGENT, ...options.headers },
  }));
}

export type Client = ReturnType<typeof createClient>;

/** The GitHub REST client; `token` is optional, since public counts need no auth. */
export function githubClient(fetchFn: FetchFn, token?: string): Client {
  return createClient({
    fetch: fetchFn,
    baseUrl: 'https://api.github.com',
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
