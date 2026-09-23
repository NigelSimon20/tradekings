/** Joins class names, dropping anything falsy. */
export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

/** Up to two initials from a person's name, for avatars. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}
