import { type SearchQuery } from '@repo/contracts';

export const SIGNED_IN_HOME = '/entries';

export const ENTRY_SEARCH_PATH = '/entries/search';

const PROBE = 'http://return-path.invalid';

export function returnPath(requested: unknown): string {
  if (typeof requested !== 'string' || !requested.startsWith('/')) {
    return SIGNED_IN_HOME;
  }
  let url: URL;
  try {
    url = new URL(requested, PROBE);
  } catch {
    return SIGNED_IN_HOME;
  }
  if (url.origin !== PROBE) {
    return SIGNED_IN_HOME;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function signInPath(from: string): string {
  return `/sign-in?${new URLSearchParams({ returnTo: from }).toString()}`;
}

const values = (value: SearchQuery[string]): readonly string[] => {
  if (value === undefined) {
    return [];
  }
  return typeof value === 'string' ? [value] : value;
};

export function pathWithQuery(path: string, query: SearchQuery): string {
  const parameters = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    for (const one of values(value)) {
      parameters.append(name, one);
    }
  }
  const search = parameters.toString();
  return search === '' ? path : `${path}?${search}`;
}
