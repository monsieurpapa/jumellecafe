/**
 * Producer code format: {COOP}-{DEVICE_CODE}-{SEQ}-{INITIALS}-{GROUPEMENT}-{VILLAGE}.
 *
 * Collision-safety: device_code is server-assigned at the device-binding
 * step (unique per cooperative — see device_bindings table) and cached
 * on-device before any offline work happens. The local sequence only needs
 * to be atomic against double-submits on the SAME device; it never needs
 * cross-device coordination, because device_code already disambiguates
 * concurrent offline registrations from different agronomes. See the plan's
 * producer-ID algorithm section for the full reasoning.
 */
export interface ProducerCodeInput {
  coopCode: string;
  deviceCode: string;
  sequence: number;
  nom: string;
  prenom: string;
  groupement: string;
  village: string;
}

function slugUpper(value: string, maxLength: number): string {
  const slug = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  return slug.slice(0, maxLength) || "XXXX";
}

export function generateProducerCode(input: ProducerCodeInput): string {
  const initials = `${input.nom.trim().charAt(0)}${input.prenom.trim().charAt(0)}`.toUpperCase();
  const seq = String(input.sequence).padStart(4, "0");
  const groupementSlug = slugUpper(input.groupement, 4);
  const villageSlug = slugUpper(input.village, 4);
  return `${input.coopCode}-${input.deviceCode}-${seq}-${initials}-${groupementSlug}-${villageSlug}`;
}
