import { Router, type IRouter } from "express";
import healthRouter from "./health";
import screeningsRouter from "./screenings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(screeningsRouter);

export default router;
