# Milestone Infrastructure

This directory contains AWS CDK code for deploying the Milestone application to AWS EC2.

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. AWS CDK CLI installed globally or via npx
3. Node.js and npm installed

## Setup

1. Install dependencies (from project root):
   ```bash
   npm install
   ```

2. Bootstrap CDK in your AWS account (first time only):
   ```bash
   npm run cdk:bootstrap
   ```

## Usage

### Synthesize CloudFormation template
```bash
npm run cdk:synth
```

Set **`CDK_DEFAULT_ACCOUNT`** and **`CDK_DEFAULT_REGION`** to match your target account/region (and existing [`cdk.context.json`](cdk.context.json) cache entries when synthesizing without live AWS lookups), for example:

```bash
CDK_DEFAULT_ACCOUNT=123456789012 CDK_DEFAULT_REGION=ap-southeast-1 npm run cdk:synth
```

### View differences
```bash
npm run cdk:diff
```

### Deploy the stack
```bash
npm run cdk:deploy
```

### Deploy with custom image name
You can pass the GitHub Container Registry image name when deploying:

```bash
cd infrastructure
npx cdk deploy --parameters imageName=ghcr.io/username/repo:latest
```

Or modify `app.ts` to include the `imageName` in the stack props.

## Architecture

The CDK app defines **two stacks** (see [`app.ts`](app.ts)):

### `MilestoneRuntimeStack`

- **S3 bucket** for document uploads (private, SSE-S3, retain on stack delete).
- **SSM StringParameter** [`/milestone/documents-s3-bucket`](./ssm-documents-bucket.ts) set to the bucket name when the stack deploys (no cross-stack references to the compute stack).

There is **no CloudFormation dependency** between `MilestoneRuntimeStack` and `MilestoneStack`; deploy either stack in any order. **`AWS_BUCKET_DOCUMENTS`** on the host is whatever **`deploy.sh`** last read from SSM: after the parameter exists, run **`/opt/milestone/bin/deploy.sh`** again to refresh `.env` (same as any other SSM-backed value).

### `MilestoneStack` (application host)

The infrastructure consists of:

- **VPC**: A VPC with public subnets only across 2 availability zones (no NAT Gateway to reduce costs)
- **EC2 Instance**: T4g.micro (Graviton/ARM64) running Amazon Linux 2023
- **Security Group**: Allows HTTP traffic on port 80 and SSH on port 22
- **IAM Role**: EC2 instance role with SSM permissions for remote management, plus **broad S3** `GetObject` / `PutObject` / `DeleteObject` / `ListBucket` on `arn:aws:s3:::*` and `arn:aws:s3:::*/*` (not scoped to the documents bucket in CDK—wider blast radius by design)
- **SSH Access**: Associates the existing `milestone-primary` key pair so `ec2-user` can log in
- **User Data**: Scripts that install Docker, Docker Compose, and set up the application
- **CloudFront Distribution**: Terminates SSL and forwards traffic (with no caching) to the EC2 origin

### Application env: `AWS_BUCKET_DOCUMENTS`

The deploy script loads values from SSM into `/opt/milestone/.env`, including **`AWS_BUCKET_DOCUMENTS`** (bucket name), **`ANTHROPIC_API_KEY`** (from `/milestone/anthropic_api_key`), and the other keys listed in `appEnvParameters` in [`milestone-app-construct.ts`](milestone-app-construct.ts). **`AWS_REGION`** is set from EC2 instance metadata during deploy when available.

Document email ingest (SES) uses **`EMAIL_INBOUND_MAIL_FQDN`**, **`EMAIL_INGEST_LOCAL_PART_PREFIX`**, **`EMAIL_INBOUND_SQS_QUEUE_URL`**, and **`EMAIL_INBOUND_SNS_TOPIC_ARN`**. The inbound CDK stack provisions three rails (prod / staging / dev): `doc-inbound`, `doc-inbound-staging`, and `doc-inbound-dev` under the hosted zone, each with its own SNS topic and SQS queue. Per-rail values are stored under **`/milestone/email-inbound/rails/<mailSubdomain>/…`** (for example `…/rails/doc-inbound/mail-fqdn`). Shared **`/milestone/email-inbound/s3-bucket-name`**, **`/milestone/email-inbound/local-part-prefix`**, **`/milestone/email-inbound/sqs-wait-time-seconds`**, and **`/milestone/email-inbound/sqs-visibility-timeout-seconds`** apply to all rails (worker tuning; defaults `20` and `300`). [`MilestoneStack`](milestone-stack.ts) passes CDK context **`emailInboundMailSubdomain`** through to [`milestone-app-construct.ts`](milestone-app-construct.ts) so each EC2 instance pulls the matching rail’s FQDN, queue URL, and topic ARN (default **`doc-inbound`** for production). If the prefix parameter is missing, deploy still writes a default **`ingest`** for `EMAIL_INGEST_LOCAL_PART_PREFIX`. Leave the queue URL unset locally to disable the ingest worker. For **architecture diagrams and per-environment flows** (SES → S3 → SNS → SQS), see [`docs/email-ingress-flows.md`](../docs/email-ingress-flows.md).

Optional **tap** queues: deploy `MilestoneEmailInboundStack` with CDK context **`emailInboundSnsTapQueues=true`** to add a second SQS queue per rail on the same SNS topic (duplicate delivery). Tap queue URLs are in **`…/rails/<mailSubdomain>/sqs-tap-queue-url`**. From the repo root (after `set -a; source .local.env; set +a` or with AWS credentials), inspect with **`npx tsx tools/aws/email-inbound-queue-util.ts exec`** or the npm wrapper **`npm run email-inbound:tap-watch`**; tap URL resolves from **`EMAIL_INBOUND_TAP_QUEUE_URL`**, then **SSM** (same rail as **`EMAIL_INBOUND_SQS_QUEUE_URL`** / **`EMAIL_INBOUND_MAIL_FQDN`**, or **`EMAIL_INBOUND_TAP_QUEUE_SSM_PARAMETER`**), then **`EMAIL_INBOUND_SQS_QUEUE_URL`** with queue name suffixed **`-tap`**. **`exec`** flags: **`--queue-url`**, **`--json`**, **`--verbose`**, **`--stats-only`**, **`--no-delete`** (on `tsx` after the subcommand, or after **`npm run … --`**). Long-poll mode prints a staged human view (SQS → SNS → S3 payload); by default it **deletes** each tap message after print, or use **`--no-delete`** to **re-queue** tap messages with visibility 0 so you can inspect backlog without draining the tap queue; stderr **`[queues · …]`** lines show approximate **visible / in-flight / delayed** counts for tap and worker queues. One-shot depths: **`npx tsx tools/aws/email-inbound-queue-util.ts exec --stats-only`** or **`npm run email-inbound:queue-stats`**. List queue URLs, SNS topic ARNs, or **approximate depths for every matching SQS queue** (all inbound worker + `*-tap` queues at once): **`npx tsx tools/aws/email-inbound-queue-util.ts show --sqs`** (optional **`--prefix`**), **`… show --sns`**, **`… show --depths`** (default prefix `milestone-email-inbound`), or combine flags. SQS does not expose “list all message bodies” without receiving them. Long-form documentation: [`docs/email-inbound-queue-util.md`](../docs/email-inbound-queue-util.md). To see which **worker** consumer called **`ReceiveMessage` / `DeleteMessage`**, use **CloudTrail data events** on the worker queue ARN or correlate **`MessageId`** with application logs.

## User Data Script

The EC2 instance user data script:
1. Updates system packages
2. Installs Docker and AWS CLI
3. Installs Docker Compose
4. Creates the application directory (`/opt/milestone`)
5. Creates `docker-compose.yml`
6. Writes `/opt/milestone/bin/deploy.sh`, which:
   - Pulls configuration and secrets from SSM Parameter Store into `/opt/milestone/.env` (including **`AWS_BUCKET_DOCUMENTS`** from `/milestone/documents-s3-bucket` when that parameter exists, and inbound mail env vars from `/milestone/email-inbound/rails/<rail>/…` plus shared `/milestone/email-inbound/local-part-prefix` and SQS tuning parameters when deployed)
   - Logs in to GitHub Container Registry (GHCR)
   - Updates the `APP_IMAGE` entry inside `.env`
   - Temporarily forces `COOKIE_DOMAIN` to the CloudFront distribution domain until custom certificates/domains are configured
   - Runs `docker-compose pull` and `docker-compose up -d`
7. Transfers ownership of `/opt/milestone` to `ec2-user` so the default SSH user can manage deployments without sudo
8. Runs the deploy script (as `ec2-user`) once to complete initial provisioning

## GitHub Container Registry Authentication

The deploy script automatically logs into GHCR by retrieving a GitHub Personal Access Token and (optionally) username from Parameter Store:

- `/milestone/github-token` (SecureString, with `read:packages` permission)
- `/milestone/github-username` (String)

If either parameter is missing the script logs a warning and continues. Private images require both values.

## SSM Deployment

After deployment, re-run the host-side deploy script using SSM:

```bash
aws ssm send-command \
  --instance-ids <INSTANCE_ID> \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["/opt/milestone/bin/deploy.sh ghcr.io/owner/repo:tag"]'
```

The GitHub Actions workflow now calls the same script during every deployment, keeping host automation and CI/CD behavior in sync.

## SSH Access

- Use the `milestone-primary` key to connect as `ec2-user`:

```bash
ssh -i ~/.ssh/milestone-primary.pem ec2-user@<INSTANCE_IP>
```

- All automation lives under `/opt/milestone`. You can run the same deploy script manually:

```bash
/opt/milestone/bin/deploy.sh ghcr.io/owner/repo:tag
```

Because `/opt/milestone` is owned by `ec2-user`, the script behaves the same whether it’s run interactively or via the GitHub Actions SSM command, and it always refreshes the `APP_IMAGE` value before restarting Docker.

## Outputs

After **`MilestoneRuntimeStack`** deployment:

- `DocumentsBucketName`: S3 bucket name for documents
- `DocumentsSsmParameterName`: SSM parameter path storing that bucket name

After **`MilestoneStack`** deployment:

- `InstanceId`: The EC2 instance ID
- `InstancePublicIp`: The public IP address of the instance
- `SSMCommand`: Example SSM command to update the application
- `CloudFrontDomain`: The CloudFront distribution domain name for HTTPS access

