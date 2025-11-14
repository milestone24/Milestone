# Deployment Setup Summary

This document summarizes the complete CI/CD setup for deploying the Milestone application to AWS EC2.

## Overview

The deployment pipeline consists of:
1. **AWS CDK Infrastructure** - Defines and provisions EC2 resources
2. **GitHub Actions Workflow** - Builds Docker images and triggers deployments
3. **AWS Systems Manager (SSM)** - Executes deployment commands on EC2

## Architecture

```
GitHub Push (main branch)
    ↓
GitHub Actions Workflow
    ├─→ Build Docker Image
    ├─→ Push to GHCR
    └─→ Send SSM Command to EC2
            ↓
        EC2 Instance (SSH = ec2-user + milestone-primary key)
            ├─→ /opt/milestone/bin/deploy.sh
            │      ├─ Pull secrets from SSM into .env
            │      ├─ Update APP_IMAGE (and temporarily COOKIE_DOMAIN) in .env
            │      ├─ Login to GHCR
            │      └─ docker-compose pull/up
            └─→ Containers restarted
        CloudFront Distribution (no cache, HTTPS)
            └─→ Forwards to EC2 HTTP origin for SSL termination
```

## Components

### 1. AWS CDK Infrastructure (`infrastructure/`)

**Files:**
- `app.ts` - CDK app entry point
- `milestone-stack.ts` - Main stack definition
- `milestone-app-construct.ts` - Single construct with all resources

**Resources Created:**
- VPC with public subnets only (2 AZs, no NAT Gateway to reduce costs)
- EC2 instance (T4g.micro Graviton, Amazon Linux 2023) keyed with `milestone-primary`
- Security group (allows HTTP on port 80 and SSH on port 22)
- IAM role with SSM permissions
- User data script for Docker setup
- CloudFront distribution with caching disabled for HTTPS termination

**Key Features:**
- EC2 instance configured with SSM agent (no SSH needed)
- User data installs Docker, AWS CLI, and Docker Compose
- Creates `/opt/milestone` directory with docker-compose.yml and `/opt/milestone/bin/deploy.sh`
- Transfers `/opt/milestone` ownership to `ec2-user` and runs the deploy script once (as `ec2-user`)
- Deploy script keeps `.env` (including `APP_IMAGE`, and temporarily `COOKIE_DOMAIN`) in sync with SSM/defaults and restarts containers
- Outputs instance ID and example SSM commands

### 2. GitHub Actions Workflow (`.github/workflows/deploy.yml`)

**Triggers:**
- Push to `main` branch (configurable)
- Only on changes to relevant files (Dockerfile, source code, etc.)

**Jobs:**

1. **build-and-push**
   - Builds Docker image using Dockerfile
   - Pushes to GitHub Container Registry (GHCR)
   - Tags images with branch name, commit SHA, and `latest`
   - Uses Docker layer caching

2. **deploy**
   - Authenticates with AWS using OIDC
   - Retrieves EC2 instance ID
   - Sends a single SSM command that runs `/opt/milestone/bin/deploy.sh <image-tag>`
   - Verifies deployment with `docker-compose ps`

**Required Secrets:**
- `AWS_ROLE_ARN` - IAM role for GitHub Actions (OIDC)
- `AWS_REGION` - AWS region (optional, defaults to us-east-1)
- `EC2_INSTANCE_ID` - EC2 instance ID (optional, can use SSM Parameter Store)
- `AWS_S3_OUTPUT_BUCKET` - S3 bucket for SSM outputs (optional)

## Setup Instructions

### Step 1: Deploy CDK Infrastructure

```bash
# Install dependencies
npm install

# Bootstrap CDK (first time only)
npm run cdk:bootstrap

# Review changes
npm run cdk:synth

# Deploy
npm run cdk:deploy
```

After deployment, note the:
- EC2 Instance ID
- Instance Public IP

### Step 2: Configure GitHub Secrets

Go to GitHub repository → Settings → Secrets and variables → Actions

Add the following secrets:

1. **AWS_ROLE_ARN**
   - Create an IAM role for GitHub OIDC
   - See `.github/workflows/README.md` for IAM policy details
   - Copy the role ARN

2. **AWS_REGION** (optional)
   - Your AWS region (e.g., `us-east-1`)

3. **EC2_INSTANCE_ID** (optional)
   - The EC2 instance ID from CDK deployment
   - Or store in SSM Parameter Store at `/milestone/ec2-instance-id`

4. **AWS_S3_OUTPUT_BUCKET** (optional)
   - S3 bucket for storing SSM command outputs

### Step 3: Configure GitHub Container Registry / Parameter Store

The workflow pushes to GHCR using the built-in `GITHUB_TOKEN`. The EC2 instance pulls images using credentials stored in Parameter Store:

```bash
aws ssm put-parameter --name "/milestone/github-token" --value "<PAT_WITH_read:packages>" --type "SecureString"
aws ssm put-parameter --name "/milestone/github-username" --value "<github-username>" --type "String"
```

Application configuration parameters are also stored under `/milestone/*` (see `tools/aws/setup.sh` for examples). The deploy script reads them into `/opt/milestone/.env` before every rollout.

### Step 4: Test the Workflow

1. Push a change to the `main` branch
2. Check GitHub Actions tab for workflow execution
3. Verify deployment on EC2:
   ```bash
   aws ssm send-command \
     --instance-ids <INSTANCE_ID> \
     --document-name "AWS-RunShellScript" \
     --parameters 'commands=["cd /opt/milestone && docker-compose ps"]'
   ```

## Manual Deployment

You can manually trigger a deployment using SSM. Pass the desired image tag (or omit it to use the default baked into the stack):

```bash
aws ssm send-command \
  --instance-ids <INSTANCE_ID> \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["/opt/milestone/bin/deploy.sh ghcr.io/owner/repo:tag"]'
```

## Troubleshooting

### SSM Command Fails
- Verify EC2 instance has SSM agent running: `sudo systemctl status amazon-ssm-agent`
- Check IAM role has `AmazonSSMManagedInstanceCore` policy
- Ensure instance is in a subnet with internet access (for SSM)

### Image Pull Fails
- Verify the deploy script fetched the GHCR token (see `/var/log/cloud-init-output.log`)
- Check GitHub token has `read:packages` permission and exists in Parameter Store
- Confirm `/opt/milestone/.env` was refreshed (timestamps/contents)

### SSH Access
- Connect with the `milestone-primary` key:

```bash
ssh -i ~/.ssh/milestone-primary.pem ec2-user@<INSTANCE_IP>
```

- Re-run deployments exactly as the CI workflow does:

```bash
/opt/milestone/bin/deploy.sh ghcr.io/owner/repo:tag
```

Because `/opt/milestone` is owned by `ec2-user`, no sudo is required.

### Deployment Verification Fails
- Check SSM command output in workflow logs
- SSH into instance (if needed) and check: `docker-compose logs app`
- Verify docker-compose.yml has correct image name

### Workflow Authentication Fails
- Verify IAM role trust policy includes GitHub OIDC provider
- Check role has correct permissions (ssm:SendCommand, etc.)
- Ensure repository name matches the condition in trust policy

## Next Steps

1. **Review and customize:**
   - Update deployment branch in workflow
   - Adjust instance type/size in CDK
   - Configure environment variables for the application

2. **Enhancements:**
   - Add staging environment
   - Implement blue-green deployments
   - Add health checks and rollback logic
   - Set up CloudWatch alarms
   - Configure domain name and SSL certificate

3. **Security:**
   - Review IAM policies (principle of least privilege)
   - Enable VPC Flow Logs
   - Set up AWS WAF if exposing publicly
   - Configure security group rules more restrictively

## Files Created

- `infrastructure/app.ts`
- `infrastructure/milestone-stack.ts`
- `infrastructure/milestone-app-construct.ts`
- `infrastructure/tsconfig.json`
- `infrastructure/cdk.json`
- `infrastructure/README.md`
- `.github/workflows/deploy.yml`
- `.github/workflows/deploy-simple.yml.example`
- `.github/workflows/README.md`
- `docs/deployment-setup.md` (this file)

## References

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS Systems Manager Documentation](https://docs.aws.amazon.com/systems-manager/)
- [GitHub Container Registry Documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)

