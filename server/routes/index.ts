import { Express, Router } from "express";
import { registerRoutes as registerUserRoutes} from "./users";
import { registerRoutes as registerAssetsRoutes} from "./assets";
import { registerRoutes as registerMilestonesRoutes} from "./milestones";
import { registerRoutes as registerFireRoutes} from "./fire-settings";
import { registerRoutes as registerSecuritiesRoutes} from "./securities";
//import { registerRoutes as registerPortfolioRoutes} from "./portfolio";
import { registerRoutes as registerAuthRoutes } from "./auth";
import { registerRoutes as registerOcrRoutes } from "./ocr";
import { registerRoutes as registerDocumentsRoutes } from "./documents";
import { registerRoutes as registerOcrJobsRoutes } from "./ocr-jobs";
//import { registerRoutes as registerVerificationRoutes } from "./verification"
import { AuthService } from "server/auth";
import { registerRoutes as registerTrackingRoutes } from "./tracking";
import { registerRoutes as registerProjectionsRoutes } from "./projections";
import { registerRoutes as registerTriggersRoutes } from "./triggers";

export async function registerRoutes(
  router: Router,
  authService: AuthService
): Promise<Router> {
  // Register API routes
  router.use("/users", await registerUserRoutes(Router(), authService));
  router.use("/assets", await registerAssetsRoutes(Router(), authService));
  router.use(
    "/milestones",
    await registerMilestonesRoutes(Router(), authService)
  );
  router.use("/fire-settings", await registerFireRoutes(Router(), authService));
  router.use(
    "/securities",
    await registerSecuritiesRoutes(Router(), authService)
  );
  router.use("/auth", await registerAuthRoutes(Router(), authService));
  router.use("/ocr", await registerOcrRoutes(Router()));
  router.use("/documents", await registerDocumentsRoutes(Router(), authService));
  router.use(
    "/ocr-jobs",
    await registerOcrJobsRoutes(Router(), authService)
  );
  router.use("/tracking", await registerTrackingRoutes(Router(), authService));
  router.use(
    "/projections",
    await registerProjectionsRoutes(Router(), authService)
  );
  router.use("/triggers", await registerTriggersRoutes(Router(), authService));
  //router.use("/verification", await registerVerificationRoutes(Router(), authService));
  return router;
} 
