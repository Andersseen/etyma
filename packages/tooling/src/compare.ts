/**
 * Orders two strings by UTF-16 code unit, like every other sorted list Etyma produces, and
 * never with `localeCompare`: that collates by the host's default locale, so two CI runners
 * with different `LANG` settings could order the same output differently.
 */
export function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
