const KEY = "lookup:recent";

export function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function pushRecent(id: string, keep = 5) {
  try {
    const next = [id, ...loadRecent().filter((x) => x !== id)].slice(0, keep);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}