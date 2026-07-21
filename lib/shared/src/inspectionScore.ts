/**
 * Grille d'évaluation agronomique (Audit Interne, Phase 4) — the 7 criteria
 * of the field inspection form, each scored 0 (critique) to 5 (excellent).
 * Single source of truth for the PWA form, the sync validator and the
 * server-side score re-derivation.
 */
export const INSPECTION_CRITERES = [
  { key: "etatPhytosanitaire", label: "État phytosanitaire des plants (maladies, ravageurs)" },
  { key: "pratiquesEntretien", label: "Pratiques d'entretien (désherbage, taille, ombrage)" },
  { key: "fertilisationSol", label: "Fertilisation & gestion du sol" },
  { key: "gestionEau", label: "Gestion de l'eau / drainage de la parcelle" },
  { key: "bonnesPratiques", label: "Respect des bonnes pratiques agricoles (GAP)" },
  { key: "conformiteEnvironnementale", label: "Conformité environnementale (déforestation, zones protégées)" },
  { key: "conditionsTravail", label: "Conditions de travail (sécurité, absence de travail des enfants)" },
] as const;

export type InspectionCritereKey = (typeof INSPECTION_CRITERES)[number]["key"];
export type InspectionScores = Record<InspectionCritereKey, number>;

/** Below this /100 global score an inspection is "non conforme". */
export const SEUIL_CONFORMITE = 60;

const MAX_PAR_CRITERE = 5;

/**
 * Score global /100 = sum of criteria / (7 × 5), rounded — e.g. all-4s
 * gives 28/35 = 80/100 like the reference form. Always recomputed
 * server-side from the raw criteria; the client's value is never trusted.
 */
export function computeInspectionScore(scores: InspectionScores): { scoreGlobal: number; conforme: boolean } {
  const total = INSPECTION_CRITERES.reduce((sum, c) => sum + scores[c.key], 0);
  const scoreGlobal = Math.round((total / (INSPECTION_CRITERES.length * MAX_PAR_CRITERE)) * 100);
  return { scoreGlobal, conforme: scoreGlobal >= SEUIL_CONFORMITE };
}
