/**
 * Populates the MAENDELEO seed cooperative (created by scripts/seed.ts)
 * with realistic sample data — a station, producteurs with GPS parcelles,
 * livraisons, a constituted lot, inspections and transactions — so the
 * Dashboard and Parcelles GPS map have something to render for a visual
 * pass. Dev/verification only; safe to re-run (skips rows that already
 * exist by their unique business key).
 */
import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import {
  db,
  cooperativesTable,
  userProfilesTable,
  stationsTable,
  producteursTable,
  parcellesTable,
  livraisonsTable,
  lotsTable,
  inspectionsTable,
  transactionsTable,
} from "@jumelle/db";
import {
  generateProducerCode,
  generateBonLivraison,
  generateLotCode,
  computeInspectionScore,
} from "@jumelle/shared";

const DEVICE_CODE = "SEED";
const COOP_CODE = "MAENDELEO";

async function main() {
  const [cooperative] = await db.select().from(cooperativesTable).where(eq(cooperativesTable.code, COOP_CODE));
  if (!cooperative) throw new Error("Run `pnpm run seed` first to create the MAENDELEO cooperative.");

  const [agronomeProfile] = await db
    .select()
    .from(userProfilesTable)
    .where(and(eq(userProfilesTable.cooperativeId, cooperative.id), eq(userProfilesTable.role, "agronome")));
  if (!agronomeProfile) throw new Error("Run `pnpm run seed` first to create the agronome accounts.");

  const [adminProfile] = await db
    .select()
    .from(userProfilesTable)
    .where(and(eq(userProfilesTable.cooperativeId, cooperative.id), eq(userProfilesTable.role, "admin_cooperative")));
  if (!adminProfile) throw new Error("Run `pnpm run seed` first to create the admin_cooperative account.");

  // --- Station ---
  const stationCode = "STA-KALEHE-01";
  let [station] = await db
    .select()
    .from(stationsTable)
    .where(and(eq(stationsTable.cooperativeId, cooperative.id), eq(stationsTable.code, stationCode)));
  if (!station) {
    [station] = await db
      .insert(stationsTable)
      .values({
        cooperativeId: cooperative.id,
        code: stationCode,
        nom: "Station Kalehe Nord",
        type: "lavage",
        village: "Kalehe",
        territoire: "Kalehe",
        latitude: -2.502,
        longitude: 28.847,
        responsableNom: "Patrice Nzigire",
        sourceEau: "Rivière Nyakalonge",
        certifications: "Bio, EUDR",
        produits: "Arabica Lavé",
        statut: "active",
      })
      .returning();
  }
  const stationRow = station!;

  // --- Producteurs + parcelles (jittered around Kalehe, Sud-Kivu) ---
  const producteurSeeds = [
    { nom: "Mushagalusa", prenom: "Jean-Baptiste", sexe: "M" as const, culture: "cafe" as const },
    { nom: "Kavira", prenom: "Aline", sexe: "F" as const, culture: "cafe" as const },
    { nom: "Bagalwa", prenom: "Espoir", sexe: "M" as const, culture: "cacao" as const },
    { nom: "Nabintu", prenom: "Chantal", sexe: "F" as const, culture: "cafe" as const },
    { nom: "Cirimwami", prenom: "Deo", sexe: "M" as const, culture: "cafe" as const },
    { nom: "Furaha", prenom: "Bahati", sexe: "F" as const, culture: "cacao" as const },
  ];

  const producteurs: { id: string; producteurId: string; parcelleLat: number; parcelleLng: number }[] = [];

  for (let i = 0; i < producteurSeeds.length; i++) {
    const seed = producteurSeeds[i]!;
    const producerCode = generateProducerCode({
      coopCode: COOP_CODE,
      deviceCode: DEVICE_CODE,
      sequence: i + 1,
      nom: seed.nom,
      prenom: seed.prenom,
      groupement: "Kalehe",
      village: "Kalehe",
    });

    let [existing] = await db
      .select()
      .from(producteursTable)
      .where(and(eq(producteursTable.cooperativeId, cooperative.id), eq(producteursTable.producerCode, producerCode)));

    if (!existing) {
      const id = randomUUID();
      [existing] = await db
        .insert(producteursTable)
        .values({
          id,
          cooperativeId: cooperative.id,
          producerCode,
          nom: seed.nom,
          prenom: seed.prenom,
          sexe: seed.sexe,
          age: 28 + i * 4,
          dateEnregistrement: new Date().toISOString().slice(0, 10),
          culturePrincipale: seed.culture,
          nombreChamps: 1 + (i % 3),
          surfaceBiologiqueHa: 0.5 + i * 0.3,
          nombrePieds: 300 + i * 50,
          estimationRendementKgHa: 450 + i * 20,
          statutIcs: i % 3 === 0 ? "biologique" : i % 3 === 1 ? "transition" : "conventionnel",
          groupement: "Kalehe",
          village: "Kalehe",
          territoire: "Kalehe",
          province: "Sud-Kivu",
          agronomeId: agronomeProfile.userId,
          deviceCode: DEVICE_CODE,
          createdOfflineAt: new Date(),
        })
        .returning();
    }

    // Small jitter so markers spread out visibly on the map instead of stacking.
    const lat = -2.5 + (i - 2.5) * 0.018 + (Math.random() - 0.5) * 0.006;
    const lng = 28.85 + (i % 3) * 0.02 + (Math.random() - 0.5) * 0.006;

    const [existingParcelle] = await db
      .select()
      .from(parcellesTable)
      .where(eq(parcellesTable.producteurId, existing!.id));

    if (!existingParcelle) {
      await db.insert(parcellesTable).values({
        id: randomUUID(),
        producteurId: existing!.id,
        cooperativeId: cooperative.id,
        latitude: lat,
        longitude: lng,
        altitudeM: 1450 + i * 15,
        superficieHa: existing!.surfaceBiologiqueHa,
      });
    }

    producteurs.push({ id: existing!.id, producteurId: existing!.id, parcelleLat: lat, parcelleLng: lng });
  }

  // --- Livraisons (first 4 producteurs deliver to the station) ---
  const livraisonIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const bonNumber = generateBonLivraison({ coopCode: COOP_CODE, deviceCode: DEVICE_CODE, sequence: i + 1 });
    let [existing] = await db
      .select()
      .from(livraisonsTable)
      .where(and(eq(livraisonsTable.cooperativeId, cooperative.id), eq(livraisonsTable.bonNumber, bonNumber)));

    if (!existing) {
      [existing] = await db
        .insert(livraisonsTable)
        .values({
          id: randomUUID(),
          cooperativeId: cooperative.id,
          producteurId: producteurs[i]!.id,
          stationId: stationRow.id,
          bonNumber,
          produit: i % 2 === 0 ? "cerises" : "parche",
          poidsKg: 120 + i * 35,
          prixUnitaireCdf: 950,
          dateLivraison: new Date().toISOString().slice(0, 10),
          agronomeId: agronomeProfile.userId,
          deviceCode: DEVICE_CODE,
          createdOfflineAt: new Date(),
        })
        .returning();
    }
    livraisonIds.push(existing!.id);
  }

  // --- Lot constituted from the first 3 livraisons ---
  const lotCode = generateLotCode({ coopCode: COOP_CODE, culture: "Arabica Lavé", unique: "SEED0001" });
  let [lot] = await db.select().from(lotsTable).where(and(eq(lotsTable.cooperativeId, cooperative.id), eq(lotsTable.code, lotCode)));
  if (!lot) {
    const memberLivraisonIds = livraisonIds.slice(0, 3);
    const poidsKg = 120 + 155 + 190; // matches the seeded weights above
    [lot] = await db
      .insert(lotsTable)
      .values({
        cooperativeId: cooperative.id,
        stationId: stationRow.id,
        code: lotCode,
        culture: "Arabica Lavé",
        poidsKg,
        eudrConforme: true,
        statut: "pret_export",
        acheteur: "Kivu Trade Export",
        paysDestination: "Belgique",
      })
      .returning();
    for (const id of memberLivraisonIds) {
      await db.update(livraisonsTable).set({ lotId: lot!.id }).where(eq(livraisonsTable.id, id));
    }
  }

  // --- Inspections: one conforme, one non-conforme ---
  const inspectionSeeds = [
    { producteurIdx: 0, scores: [5, 4, 4, 5, 4, 5, 5], recommandations: "Exploitation bien entretenue, RAS." },
    { producteurIdx: 2, scores: [1, 2, 1, 2, 1, 1, 2], recommandations: "Traiter la rouille orangée, renforcer l'ombrage, revoir la gestion de l'eau." },
  ];
  for (const seed of inspectionSeeds) {
    const producteur = producteurs[seed.producteurIdx]!;
    const [existingInspection] = await db
      .select()
      .from(inspectionsTable)
      .where(eq(inspectionsTable.producteurId, producteur.id));
    if (existingInspection) continue;

    const scores = {
      etatPhytosanitaire: seed.scores[0]!,
      pratiquesEntretien: seed.scores[1]!,
      fertilisationSol: seed.scores[2]!,
      gestionEau: seed.scores[3]!,
      bonnesPratiques: seed.scores[4]!,
      conformiteEnvironnementale: seed.scores[5]!,
      conditionsTravail: seed.scores[6]!,
    };
    const { scoreGlobal, conforme } = computeInspectionScore(scores);
    await db.insert(inspectionsTable).values({
      id: randomUUID(),
      cooperativeId: cooperative.id,
      producteurId: producteur.id,
      dateInspection: new Date().toISOString().slice(0, 10),
      ...scores,
      scoreGlobal,
      conforme,
      recommandations: seed.recommandations,
      agronomeId: agronomeProfile.userId,
      deviceCode: DEVICE_CODE,
      createdOfflineAt: new Date(),
    });
  }

  // --- Transactions ---
  const transactionSeeds = [
    { type: "achat" as const, produit: "cerises" as const, contrepartie: "Producteurs membres", quantiteKg: 500, prixUnitaireCdf: 950 },
    { type: "achat" as const, produit: "parche" as const, contrepartie: "Producteurs membres", quantiteKg: 300, prixUnitaireCdf: 1400 },
    { type: "vente" as const, produit: "cafe_vert" as const, contrepartie: "Kivu Trade Export", quantiteKg: 400, prixUnitaireCdf: 3200 },
  ];
  for (let i = 0; i < transactionSeeds.length; i++) {
    const seed = transactionSeeds[i]!;
    const reference = `TRX-SEED-${String(i + 1).padStart(4, "0")}`;
    const [existing] = await db
      .select()
      .from(transactionsTable)
      .where(and(eq(transactionsTable.cooperativeId, cooperative.id), eq(transactionsTable.reference, reference)));
    if (existing) continue;
    await db.insert(transactionsTable).values({
      cooperativeId: cooperative.id,
      reference,
      type: seed.type,
      produit: seed.produit,
      contrepartie: seed.contrepartie,
      quantiteKg: seed.quantiteKg,
      prixUnitaireCdf: seed.prixUnitaireCdf,
      montantCdf: seed.quantiteKg * seed.prixUnitaireCdf,
      dateTransaction: new Date().toISOString().slice(0, 10),
      createdBy: adminProfile.userId,
    });
  }

  console.log("Sample data seeded for MAENDELEO:");
  console.log(`  Station:     ${stationRow.code}`);
  console.log(`  Producteurs: ${producteurs.length} (each with a GPS parcelle)`);
  console.log(`  Livraisons:  ${livraisonIds.length}`);
  console.log(`  Lot:         ${lotCode}`);
  console.log(`  Inspections: ${inspectionSeeds.length}`);
  console.log(`  Transactions: ${transactionSeeds.length}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
