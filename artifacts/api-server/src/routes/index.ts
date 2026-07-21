import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import meRouter from "./me.js";
import cooperativesRouter from "./cooperatives.js";
import deviceBindingsRouter from "./deviceBindings.js";
import powersyncRouter from "./powersync.js";
import syncRouter from "./sync.js";
import producteursRouter from "./producteurs.js";
import stationsRouter from "./stations.js";
import livraisonsRouter from "./livraisons.js";
import lotsRouter from "./lots.js";
import inspectionsRouter from "./inspections.js";
import transactionsRouter from "./transactions.js";
import parcellesRouter from "./parcelles.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use(cooperativesRouter);
router.use(deviceBindingsRouter);
router.use(powersyncRouter);
router.use(syncRouter);
router.use(producteursRouter);
router.use(stationsRouter);
router.use(livraisonsRouter);
router.use(lotsRouter);
router.use(inspectionsRouter);
router.use(transactionsRouter);
router.use(parcellesRouter);
// Further domain routers (marché & export, assurance, ...) are added
// here as each phase builds them — see plan §6.

export default router;
