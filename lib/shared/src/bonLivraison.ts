/**
 * Bon de livraison number format: {COOP}-{DEVICE_CODE}-BL-{SEQ}.
 *
 * Same collision-safety design as producerCode.ts: device_code is
 * server-assigned and unique per cooperative, so the local sequence only
 * needs to be atomic against double-submits on the SAME device — no
 * cross-device coordination required for offline receipt numbering.
 */
export interface BonLivraisonInput {
  coopCode: string;
  deviceCode: string;
  sequence: number;
}

export function generateBonLivraison(input: BonLivraisonInput): string {
  const seq = String(input.sequence).padStart(4, "0");
  return `${input.coopCode}-${input.deviceCode}-BL-${seq}`;
}
