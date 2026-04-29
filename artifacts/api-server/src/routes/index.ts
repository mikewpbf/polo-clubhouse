import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import clubsRouter from "./clubs";
import fieldsRouter from "./fields";
import teamsRouter from "./teams";
import tournamentsRouter from "./tournaments";
import matchesRouter from "./matches";
import outDatesRouter from "./out-dates";
import playDatesRouter from "./play-dates";
import scheduleRouter from "./schedule";
import invitesRouter from "./invites";
import adminUsersRouter from "./admin-users";
import aiWizardRouter from "./ai-wizard";
import storageRouter from "./storage";
import imageProxyRouter from "./image-proxy";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(storageRouter);
router.use(imageProxyRouter);
router.use(clubsRouter);
router.use(fieldsRouter);
router.use(teamsRouter);
router.use(tournamentsRouter);
router.use(matchesRouter);
router.use(outDatesRouter);
router.use(playDatesRouter);
router.use(scheduleRouter);
router.use(invitesRouter);
router.use(adminUsersRouter);
router.use(aiWizardRouter);

export default router;
