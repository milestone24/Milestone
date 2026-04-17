import { Router, Response } from "express";
import { AuthRequest, AuthService } from "server/auth";
import { regExpPath, uuidRouteParam } from "@server/utils/uuid";
import {
  emailIngestInboxCreateRequestSchema,
  emailIngestInboxUpdateAllowedSendersRequestSchema,
} from "@shared/schema/email-ingest";
import {
  createEmailIngestInbox,
  getEmailIngestInbox,
  listEmailIngestInboxes,
  regenerateEmailIngestInbox,
  revokeEmailIngestInbox,
  updateEmailIngestInboxAllowedSenders,
} from "@server/services/email-ingest/email-ingest-inbox-service";

function parseIncludeRevoked(query: unknown): boolean {
  const raw =
    typeof query === "object" &&
    query !== null &&
    "includeRevoked" in query &&
    typeof (query as { includeRevoked?: unknown }).includeRevoked === "string"
      ? (query as { includeRevoked: string }).includeRevoked
      : undefined;
  if (!raw) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function handleServiceError(res: Response, err: unknown) {
  const status = (err as { status?: number }).status;
  const message = err instanceof Error ? err.message : "Unexpected error";
  if (status === 404) {
    return res.status(404).json({ error: message });
  }
  if (status === 403) {
    return res.status(403).json({ error: message });
  }
  if (status === 409) {
    return res.status(409).json({ error: message });
  }
  throw err;
}

export async function registerRoutes(
  router: Router,
  authService: AuthService,
): Promise<Router> {
  const { requireUser } = authService.getAuthMiddlewares();

  router.get("/", requireUser, async (req: AuthRequest, res: Response) => {
    const includeRevoked = parseIncludeRevoked(req.query);
    const rows = await listEmailIngestInboxes({ includeRevoked });
    res.json(rows);
  });

  router.post("/", requireUser, async (req: AuthRequest, res: Response) => {
    const parsed = emailIngestInboxCreateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    try {
      const created = await createEmailIngestInbox(parsed.data);
      res.status(201).json(created);
    } catch (err) {
      return handleServiceError(res, err);
    }
  });

  router.get(
    regExpPath(`/${uuidRouteParam("inboxId")}`),
    requireUser,
    async (req: AuthRequest, res: Response) => {
      const { inboxId } = req.params;
      if (!inboxId) {
        return res.status(400).json({ error: "Inbox ID is required" });
      }
      const row = await getEmailIngestInbox(inboxId);
      if (!row) {
        return res.status(404).json({ error: "Inbox not found" });
      }
      res.json(row);
    },
  );

  router.patch(
    regExpPath(`/${uuidRouteParam("inboxId")}/allowed-senders`),
    requireUser,
    async (req: AuthRequest, res: Response) => {
      const { inboxId } = req.params;
      if (!inboxId) {
        return res.status(400).json({ error: "Inbox ID is required" });
      }
      const parsed = emailIngestInboxUpdateAllowedSendersRequestSchema.safeParse(
        req.body,
      );
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      try {
        const updated = await updateEmailIngestInboxAllowedSenders(
          inboxId,
          parsed.data,
        );
        res.json(updated);
      } catch (err) {
        return handleServiceError(res, err);
      }
    },
  );

  router.post(
    regExpPath(`/${uuidRouteParam("inboxId")}/revoke`),
    requireUser,
    async (req: AuthRequest, res: Response) => {
      const { inboxId } = req.params;
      if (!inboxId) {
        return res.status(400).json({ error: "Inbox ID is required" });
      }
      try {
        const updated = await revokeEmailIngestInbox(inboxId);
        res.json(updated);
      } catch (err) {
        return handleServiceError(res, err);
      }
    },
  );

  router.post(
    regExpPath(`/${uuidRouteParam("inboxId")}/regenerate`),
    requireUser,
    async (req: AuthRequest, res: Response) => {
      const { inboxId } = req.params;
      if (!inboxId) {
        return res.status(400).json({ error: "Inbox ID is required" });
      }
      try {
        const created = await regenerateEmailIngestInbox(inboxId);
        res.status(201).json(created);
      } catch (err) {
        return handleServiceError(res, err);
      }
    },
  );

  return router;
}
