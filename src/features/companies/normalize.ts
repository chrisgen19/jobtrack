/** Case- and whitespace-insensitive key used to find-or-create companies. */
export function normalizeCompanyName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
