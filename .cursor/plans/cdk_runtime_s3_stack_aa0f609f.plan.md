---
name: CDK runtime S3 stack
overview: Add MilestoneRuntimeStack (S3 documents bucket + SSM StringParameter for bucket name). Compute stack adds general S3 on EC2 instance role and appEnvParameters mapping SSM → AWS_BUCKET_DOCUMENTS. Rename app/runtime env from S3_BUCKET to AWS_BUCKET_DOCUMENTS everywhere (DocumentService, docker-compose template, local env docs). No CFN cross-stack bucket wiring.
todos:
  - id: runtime-stack-file
    content: "Add milestone-runtime-stack.ts: S3 bucket + ssm.StringParameter (shared /milestone/... path) = bucket.bucketName + CfnOutputs + removal policy"
    status: completed
  - id: ssm-param-constant
    content: "Shared constant DOCUMENTS_S3_BUCKET_PARAMETER_NAME (e.g. infrastructure/ssm-documents-bucket.ts) for runtime stack + appEnvParameters"
    status: completed
  - id: app-env-aws-bucket-documents
    content: "Server + any callers: replace process.env.S3_BUCKET with process.env.AWS_BUCKET_DOCUMENTS (DocumentService and grep repo)"
    status: completed
  - id: wire-app-ts
    content: Instantiate MilestoneRuntimeStack in infrastructure/app.ts alongside MilestoneStack (same env); no bucket props into MilestoneStack
    status: completed
  - id: ec2-instance-role-s3
    content: "milestone-app-construct: broad S3 policy on instanceRole (not bucket-scoped in CDK)"
    status: completed
  - id: deploy-env-aws-bucket-documents
    content: "milestone-app-construct: appEnvParameters envVar AWS_BUCKET_DOCUMENTS + docker-compose environment entry AWS_BUCKET_DOCUMENTS (remove S3_BUCKET if present)"
    status: completed
  - id: readme-runtime
    content: "README + .local.env / deployment docs: document AWS_BUCKET_DOCUMENTS, SSM path, stack independence, general S3 tradeoff"
    status: completed
  - id: synth-verify
    content: Run npm run check and cdk synth
    status: completed
isProject: true
---

# CDK runtime resources stack (S3 bucket + SSM + `AWS_BUCKET_DOCUMENTS`)

**Implemented** — see repository for current behaviour.

**Env rename:** Use **`AWS_BUCKET_DOCUMENTS`** as the **only** application environment variable for the documents bucket name (replacing **`S3_BUCKET`**, which is too ambiguous). Implementation must **grep** the repo and update **server** ([`DocumentService`](server/services/documents/index.ts)), **CDK docker-compose template** in [`milestone-app-construct.ts`](infrastructure/milestone-app-construct.ts), **example / local env files** (e.g. [`.local.env`](.local.env) if it references the old name), and any **docs** that mention `S3_BUCKET`.

**No cross-stack CloudFormation wiring** for the bucket. **Shared contract** is a **fixed SSM parameter name** under `/milestone/...`: the **runtime stack** creates `ssm.StringParameter` with `stringValue: bucket.bucketName`; **deploy** loads it into `.env` as **`AWS_BUCKET_DOCUMENTS=...`** via **`appEnvParameters`** (same mechanism as `DATABASE_URL`).

## SSM parameter (global key)

- Example path: **`/milestone/documents-s3-bucket`** (String tier — bucket name is not a high-sensitivity secret).
- **Shared module** (e.g. [`infrastructure/ssm-documents-bucket.ts`](infrastructure/ssm-documents-bucket.ts)): export `DOCUMENTS_S3_BUCKET_PARAMETER_NAME` used by **both** runtime stack and **`appEnvParameters`** in [`milestone-app-construct.ts`](infrastructure/milestone-app-construct.ts).
- **Runtime stack:** `StringParameter` bound to that name, value = `bucket.bucketName`.
- **Compute stack:** `{ envVar: "AWS_BUCKET_DOCUMENTS", parameterName: DOCUMENTS_S3_BUCKET_PARAMETER_NAME, secure: false }`. The instance’s existing **`ssm:GetParameter`** allowance on `parameter/milestone/*` (already configured on the host role in [`milestone-app-construct.ts`](infrastructure/milestone-app-construct.ts)) covers this path—no new SSM read permissions required if the parameter stays under `/milestone/`.

**Stack independence:** No CloudFormation link between the two stacks; deploy order is not required. **`deploy.sh`** writes **`AWS_BUCKET_DOCUMENTS`** when the SSM parameter is present—re-run deploy after the parameter exists to refresh `.env`.

## EC2 — broad S3 access

**`instanceRole.addToPolicy`** (same construct as today): attach a policy statement with broad S3 actions on `arn:aws:s3:::*` and `arn:aws:s3:::*/*` (not bucket-scoped in CDK). README: document the wider blast radius vs single-bucket scoping.

## Implementation checklist

1. **`DOCUMENTS_S3_BUCKET_PARAMETER_NAME`** constant file.
2. **`milestone-runtime-stack.ts`:** bucket + SSM parameter + outputs.
3. **`app.ts`:** instantiate runtime stack.
4. **Application:** `AWS_BUCKET_DOCUMENTS` in DocumentService (bucket constructor); full-repo grep for `S3_BUCKET`.
5. **`milestone-app-construct.ts`:** `appEnvParameters` row; docker-compose `environment` uses **`AWS_BUCKET_DOCUMENTS`**; general S3 policy on `instanceRole`.
6. **README / local env examples:** use **`AWS_BUCKET_DOCUMENTS`**.

## Out of scope (unless extended)

- Cross-stack `IBucket` grants or `Fn.importValue` for bucket permission wiring between stacks.
- Programmatic access keys for S3 provisioned by this CDK change.
