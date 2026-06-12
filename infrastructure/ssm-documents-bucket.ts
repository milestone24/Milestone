/**
 * SSM Parameter Store name for the documents upload bucket (bucket name only).
 * Must match `MilestoneRuntimeStack` and `appEnvParameters` in milestone-app-construct.
 */
export const DOCUMENTS_S3_BUCKET_PARAMETER_NAME =
  "/milestone/documents-s3-bucket";
