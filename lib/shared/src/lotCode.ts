/**
 * Lot code format: LOT-{CULTURE}-{COOP}-{UNIQUE}.
 *
 * Lots are constituted ONLINE by the Admin (Phase 3), so no offline
 * collision-safety scheme is needed — `unique` is server-generated
 * randomness (e.g. a uuid slice), kept as an explicit input so the
 * function stays deterministic and testable. The per-cooperative unique
 * index on lots.code is the safety net.
 */
export interface LotCodeInput {
  coopCode: string;
  culture: string;
  unique: string;
}

function cultureSlug(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  return slug.slice(0, 3) || "XXX";
}

export function generateLotCode(input: LotCodeInput): string {
  return `LOT-${cultureSlug(input.culture)}-${input.coopCode}-${input.unique.toUpperCase()}`;
}
