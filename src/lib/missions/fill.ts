const PLACEHOLDER = /\{([a-z_]+)\}/g;

export function extractPlaceholders(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((m) => m[1]);
}

/** Throws on unknown keys, so Gemma output with invented placeholders fails validation. */
export function fill(template: string, facts: Record<string, string>): string {
  return template.replace(PLACEHOLDER, (_, key: string) => {
    const value = facts[key];
    if (value === undefined) throw new Error(`Unknown placeholder {${key}}`);
    return value;
  });
}