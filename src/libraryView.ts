// Filtering and sorting of the parts bin. Usage counts live in this browser only.
export type LibrarySort = 'default' | 'name' | 'used' | 'recent-used' | 'added';
export type LibrarySource = 'all' | 'builtin' | 'catalog' | 'mine' | 'used';
export type LibraryView = { sort: LibrarySort; source: LibrarySource; category: string };
export type Usage = Record<string, { n: number; last: number }>;

export const DEFAULT_VIEW: LibraryView = { sort: 'default', source: 'all', category: '' };
const VIEW_KEY = 'c3d-library-view';
const USAGE_KEY = 'c3d-part-usage';

const SORTS: LibrarySort[] = ['default', 'name', 'used', 'recent-used', 'added'];
const SOURCES: LibrarySource[] = ['all', 'builtin', 'catalog', 'mine', 'used'];

export function loadView(): LibraryView {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) ?? '{}');
    return {
      sort: SORTS.includes(v.sort) ? v.sort : DEFAULT_VIEW.sort,
      source: SOURCES.includes(v.source) ? v.source : DEFAULT_VIEW.source,
      category: typeof v.category === 'string' ? v.category : '',
    };
  } catch { return DEFAULT_VIEW; }
}
export function saveView(v: LibraryView) { try { localStorage.setItem(VIEW_KEY, JSON.stringify(v)); } catch { /* storage unavailable */ } }

export function loadUsage(): Usage {
  try {
    const u = JSON.parse(localStorage.getItem(USAGE_KEY) ?? '{}');
    return u && typeof u === 'object' ? u : {};
  } catch { return {}; }
}
export function recordUse(id: string, usage: Usage, now = Date.now()): Usage {
  const next = { ...usage, [id]: { n: (usage[id]?.n ?? 0) + 1, last: now } };
  try { localStorage.setItem(USAGE_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  return next;
}

/** Where a row comes from: shipped parts, the seeded module catalogue, or the user's own parts. */
export const sourceOf = (id: string): Exclude<LibrarySource, 'all' | 'used'> =>
  id.startsWith('custom:builtin-') ? 'catalog' : id.startsWith('custom:') ? 'mine' : 'builtin';

/** rows are [id, name, category, detail]; addedAt maps ids to creation time (missing = 0). */
export function viewRows(rows: string[][], view: LibraryView, usage: Usage, addedAt: Record<string, number> = {}): string[][] {
  let out = rows.filter(r => {
    if (view.category && r[2] !== view.category) return false;
    if (view.source === 'used') return (usage[r[0]]?.n ?? 0) > 0;
    return view.source === 'all' || sourceOf(r[0]) === view.source;
  });
  const byName = (a: string[], b: string[]) => a[1].localeCompare(b[1], undefined, { sensitivity: 'base', numeric: true });
  if (view.sort === 'name') out = [...out].sort(byName);
  else if (view.sort === 'used') out = [...out].sort((a, b) => (usage[b[0]]?.n ?? 0) - (usage[a[0]]?.n ?? 0) || byName(a, b));
  else if (view.sort === 'recent-used') out = [...out].sort((a, b) => (usage[b[0]]?.last ?? 0) - (usage[a[0]]?.last ?? 0) || byName(a, b));
  else if (view.sort === 'added') out = [...out].sort((a, b) => (addedAt[b[0]] ?? 0) - (addedAt[a[0]] ?? 0) || byName(a, b));
  return out;
}
