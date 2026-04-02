import { Router, Request } from "express";
import multer from "multer";
import { AuthService } from "server/auth";
import { DocumentService } from "@server/services/documents";

const upload = multer({ storage: multer.memoryStorage() });
const documentService = new DocumentService();

export async function registerRoutes(
  router: Router,
  authService: AuthService
): Promise<Router> {
  const { requireUser } = authService.getAuthMiddlewares();

  router.post(
    "/",
    requireUser,
    upload.single("file"),
    async (req: Request, res) => {
      if (!req.file) {
        return res.status(400).json({ error: "A file is required" });
      }

      const document = await documentService.upload(req.file);
      res.status(201).json(document);
    }
  );

  router.delete("/:documentId", requireUser, async (req: Request, res) => {
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({ error: "Document ID is required" });
    }

    try {
      await documentService.delete(documentId);
      res.status(204).send();
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 404) return res.status(404).json({ error: (err as Error).message });
      if (status === 403) return res.status(403).json({ error: (err as Error).message });
      if (status === 409) return res.status(409).json({ error: (err as Error).message });
      throw err;
    }
  });

  return router;
}
