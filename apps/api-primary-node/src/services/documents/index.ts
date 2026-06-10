import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { desc, eq, inArray } from "drizzle-orm";
import path from "path";
import { db } from "@/db";
import {
  documents,
  assetTransactionDocuments,
  securityTransactionDocuments,
  processes,
  ocrJobs,
} from "@/db/schema";
import type { DocumentSelect } from "@/db/schema";
import type { DocumentWithOcr } from "@shared/schema/document";
import { getUserAccountId } from "@/auth";

const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? "development";

function buildS3Key(userAccountId: string, originalName: string): string {
  const ext = path.extname(originalName);
  return `${appEnv}/documents/${userAccountId}/${crypto.randomUUID()}${ext}`;
}

export class DocumentService {
  private s3: S3Client;
  private bucket: string;

  constructor() {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION ?? "ap-southeast-1",
    });
    this.bucket = process.env.AWS_BUCKET_DOCUMENTS ?? "";
  }

  /**
   * Inserts the documents row first inside a transaction, then uploads to S3.
   * If the S3 upload fails, the transaction rolls back and no DB row is left
   * behind, keeping DB and S3 consistent.
   */
  async upload(file: Express.Multer.File): Promise<DocumentSelect> {
    const accountId = getUserAccountId();
    const key = buildS3Key(accountId, file.originalname);
    let inserted: DocumentSelect | undefined;

    await db.transaction(async (tx) => {
      const [doc] = await tx
        .insert(documents)
        .values({
          userAccountId: accountId,
          fileName: file.originalname,
          fileUrl: key,
          mimeType: file.mimetype,
        })
        .returning();

      if (!doc) {
        throw new Error("Failed to insert document record");
      }

      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );

      inserted = doc;
    });

    return inserted!;
  }

  async getBuffer(
    documentId: string
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!doc) {
      throw Object.assign(new Error("Document not found"), { status: 404 });
    }

    const response = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: doc.fileUrl,
      })
    );

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }

    return { buffer: Buffer.concat(chunks), mimeType: doc.mimeType };
  }

  /**
   * All guards and the DB delete run inside a single transaction.
   * The S3 delete is also performed inside the transaction callback —
   * if S3 fails, the transaction rolls back and the documents row is restored,
   * keeping DB and S3 in a consistent state.
   */
  async getForAccount(userAccountId: string): Promise<DocumentWithOcr[]> {
    const docRows = await db
      .select({
        id: documents.id,
        userAccountId: documents.userAccountId,
        assetId: documents.assetId,
        fileName: documents.fileName,
        fileUrl: documents.fileUrl,
        mimeType: documents.mimeType,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(eq(documents.userAccountId, userAccountId))
      .orderBy(desc(documents.createdAt));

    if (docRows.length === 0) {
      return [];
    }

    const docIds = docRows.map((d) => d.id);
    const jobRows = await db
      .select({
        id: ocrJobs.id,
        documentId: ocrJobs.documentId,
        status: ocrJobs.status,
        platformKey: ocrJobs.platformKey,
        startedAt: ocrJobs.startedAt,
        completedAt: ocrJobs.completedAt,
        error: ocrJobs.error,
        reviewState: ocrJobs.reviewState,
      })
      .from(ocrJobs)
      .where(inArray(ocrJobs.documentId, docIds))
      .orderBy(desc(ocrJobs.startedAt));

    const jobsByDocumentId = new Map<string, typeof jobRows>();

    for (const j of jobRows) {
      if (!j.documentId) {
        continue;
      }
      const list = jobsByDocumentId.get(j.documentId) ?? [];
      list.push(j);
      jobsByDocumentId.set(j.documentId, list);
    }

    for (const list of jobsByDocumentId.values()) {
      list.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    }

    return docRows.map((doc) => ({
      id: doc.id,
      userAccountId: doc.userAccountId,
      assetId: doc.assetId,
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
      mimeType: doc.mimeType,
      createdAt: doc.createdAt ?? new Date(),
      updatedAt: doc.updatedAt ?? new Date(),
      ocrJobs: (jobsByDocumentId.get(doc.id) ?? []).map((j) => ({
        id: j.id,
        status: j.status,
        platformKey: j.platformKey,
        startedAt: j.startedAt,
        completedAt: j.completedAt,
        error: j.error,
        reviewState: j.reviewState,
      })),
    }));
  }

  async delete(documentId: string): Promise<void> {
    const accountId = getUserAccountId();

    await db.transaction(async (tx) => {
      const doc = await tx.query.documents.findFirst({
        where: eq(documents.id, documentId),
      });

      if (!doc) {
        throw Object.assign(new Error("Document not found"), { status: 404 });
      }

      if (doc.userAccountId !== accountId) {
        throw Object.assign(new Error("Forbidden"), { status: 403 });
      }

      const [assetLink, securityLink] = await Promise.all([
        tx.query.assetTransactionDocuments.findFirst({
          where: eq(assetTransactionDocuments.documentId, documentId),
        }),
        tx.query.securityTransactionDocuments.findFirst({
          where: eq(securityTransactionDocuments.documentId, documentId),
        }),
      ]);

      if (assetLink || securityLink) {
        throw Object.assign(
          new Error(
            "Document is linked to a transaction and cannot be deleted"
          ),
          { status: 409 }
        );
      }

      const inFlightProcess = await tx.query.processes.findFirst({
        where: (p, { and, sql }) =>
          and(
            inArray(p.status, ["pending", "running"]),
            sql`${p.payload}->>'documentId' = ${documentId}`
          ),
      });

      if (inFlightProcess) {
        throw Object.assign(
          new Error("An OCR job is currently in progress for this document"),
          { status: 409 }
        );
      }

      await tx.delete(documents).where(eq(documents.id, documentId));

      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: doc.fileUrl,
        })
      );
    });
  }
}
