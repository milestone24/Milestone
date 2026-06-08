import { Router, Response } from "express";
import { AuthRequest, AuthService, requireTenantWithUserAccountId } from "server/auth";
import { regExpPath, uuidRouteParam } from "@server/utils/uuid";
import { ocrJobReviewRequestSchema } from "@shared/schema/document";
import { recordOcrJobReviewOutcome } from "@server/services/ocr/ocr-job-review-service";
import {
  getOcrJobDetailForAccount,
  listOcrJobsForAccount,
} from "@server/services/ocr/ocr-jobs-account-service";

export async function registerRoutes(
  router: Router,
  authService: AuthService
): Promise<Router> {
  const { requireUser } = authService.getAuthMiddlewares();

  router.get("/", requireUser, async (req: AuthRequest, res: Response) => {
    const rows = await requireTenantWithUserAccountId(req.tenant, async (tenant) =>
      listOcrJobsForAccount(tenant.userAccountId)
    );
    res.json(rows);
  });

  router.get(
    regExpPath(`/${uuidRouteParam("ocrJobId")}`),
    requireUser,
    async (req: AuthRequest, res: Response) => {
      const { ocrJobId } = req.params;
      if (!ocrJobId) {
        return res.status(400).json({ error: "OCR job ID is required" });
      }

      const row = await requireTenantWithUserAccountId(req.tenant, async (tenant) =>
        getOcrJobDetailForAccount({
          userAccountId: tenant.userAccountId,
          ocrJobId,
        })
      );

      if (!row) {
        return res.status(404).json({ error: "OCR job not found" });
      }

      res.json(row);
    }
  );

  router.post(
    regExpPath(`/${uuidRouteParam("ocrJobId")}/review`),
    requireUser,
    async (req: AuthRequest, res: Response) => {
      const { ocrJobId } = req.params;
      if (!ocrJobId) {
        return res.status(400).json({ error: "OCR job ID is required" });
      }

      const parsed = ocrJobReviewRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const result = await requireTenantWithUserAccountId(
        req.tenant,
        async (tenant) =>
          recordOcrJobReviewOutcome({
            userAccountId: tenant.userAccountId,
            ocrJobId,
            body: parsed.data,
          })
      );

      if (!result.ok) {
        const status = result.error === "Forbidden" ? 403 : 400;
        return res.status(status).json({ error: result.error });
      }

      res.status(204).send();
    }
  );

  return router;
}
