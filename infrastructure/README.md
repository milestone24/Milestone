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

The infrastructure consists of:

- **VPC**: A VPC with public subnets only across 2 availability zones (no NAT Gateway to reduce costs)
- **EC2 Instance**: T4g.micro (Graviton/ARM64) running Amazon Linux 2023
- **Security Group**: Allows HTTP traffic on port 80 and SSH on port 22
- **IAM Role**: EC2 instance role with SSM permissions for remote management
- **SSH Access**: Associates the existing `milestone-primary` key pair so `ec2-user` can log in
- **User Data**: Scripts that install Docker, Docker Compose, and set up the application
- **CloudFront Distribution**: Terminates SSL and forwards traffic (with no caching) to the EC2 origin

## User Data Script

The EC2 instance user data script:
1. Updates system packages
2. Installs Docker and AWS CLI
3. Installs Docker Compose
4. Creates the application directory (`/opt/milestone`)
5. Creates `docker-compose.yml`
6. Writes `/opt/milestone/bin/deploy.sh`, which:
   - Pulls secrets from SSM Parameter Store into `/opt/milestone/.env`
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

After deployment, the stack outputs:
- `InstanceId`: The EC2 instance ID
- `InstancePublicIp`: The public IP address of the instance
- `SSMCommand`: Example SSM command to update the application
- `CloudFrontDomain`: The CloudFront distribution domain name for HTTPS access

