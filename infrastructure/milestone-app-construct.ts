import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import { Construct } from "constructs";

export interface MilestoneAppConstructProps {
  /**
   * GitHub Container Registry image name (e.g., ghcr.io/username/repo)
   * @default - Will use placeholder that needs to be updated
   */
  imageName?: string;
}

export class MilestoneAppConstruct extends Construct {
  public readonly instance: ec2.Instance;
  public readonly instanceId: string;
  public readonly distribution: cloudfront.Distribution;

  constructor(
    scope: Construct,
    id: string,
    props?: MilestoneAppConstructProps
  ) {
    super(scope, id);

    // Create VPC with public subnets only (no NAT Gateway needed)
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
    });

    // Create security group for the EC2 instance
    const securityGroup = new ec2.SecurityGroup(this, "InstanceSecurityGroup", {
      vpc,
      description: "Security group for Milestone application instance",
      allowAllOutbound: true,
    });

    // Allow HTTP traffic on port 5000 (application port)
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP traffic to application"
    );
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      "Allow SSH access"
    );

    // Create IAM role for EC2 instance with SSM permissions
    const instanceRole = new iam.Role(this, "InstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      description: "IAM role for Milestone EC2 instance with SSM access",
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore"
        ),
      ],
    });

    // Grant permissions to retrieve GitHub token from SSM Parameter Store
    // for authenticating with GitHub Container Registry
    const stack = cdk.Stack.of(this);
    instanceRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["ssm:GetParameters", "ssm:GetParameter"],
        resources: [
          `arn:aws:ssm:${stack.region}:${stack.account}:parameter/milestone/*`,
        ],
      })
    );

    instanceRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["cloudfront:ListDistributions"],
        resources: ["*"],
      })
    );

    // Create instance profile
    const instanceProfile = new iam.InstanceProfile(this, "InstanceProfile", {
      role: instanceRole,
    });

    /**
    You can verify using the following steps:
    SSH on launch EC2 instance.
    Check the log of your user data script in:
    sudo vi /var/log/cloud-init.log and
    sudo vi /var/log/cloud-init-output.log
    */

    // Create user data script
    const userData = ec2.UserData.forLinux();

    // Install Docker
    userData.addCommands(
      "yum update -y",
      "yum install -y docker awscli",
      "service docker start",
      "usermod -a -G docker ec2-user",
      "chkconfig docker on"
    );

    // Install Docker Compose
    userData.addCommands(
      'curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose',
      "chmod +x /usr/local/bin/docker-compose",
      "docker-compose --version"
    );

    // Create application directory
    userData.addCommands("mkdir -p /opt/milestone", "cd /opt/milestone");

    // Create docker-compose.yml file
    const imageName = props?.imageName || "milestone-staging:latest";
    const imagePort = 5001;
    const dockerComposeContent = `version: '3.8'
services:
  app:
    image: \${APP_IMAGE}
    restart: always
    ports:
      - '80:${imagePort}'
    environment:
      - NODE_ENV=production
      - PORT=${imagePort}
      - DATABASE_URL=\${DATABASE_URL}
      - JWT_SECRET=\${JWT_SECRET}
      - REFRESH_TOKEN_SECRET=\${REFRESH_TOKEN_SECRET}
      - ACCESS_TOKEN_EXPIRY=\${ACCESS_TOKEN_EXPIRY}
      - REFRESH_TOKEN_EXPIRY=\${REFRESH_TOKEN_EXPIRY}
      - COOKIE_DOMAIN=\${COOKIE_DOMAIN}
      - COOKIE_SECRET=\${COOKIE_SECRET}
      - TRADING_212_API_KEY=\${TRADING_212_API_KEY}
      - ALPHA_VANTAGE_API_KEY=\${ALPHA_VANTAGE_API_KEY}
      - EODHD_API_KEY=\${EODHD_API_KEY}
    networks:
      - milestone-network

networks:
  milestone-network:
    driver: bridge
`;

    // Write docker-compose.yml
    userData.addCommands(
      `cat > /opt/milestone/docker-compose.yml << 'EOF'
${dockerComposeContent}
EOF`
    );

    // Create EC2 instance
    this.instance = new ec2.Instance(this, "Instance", {
      vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.MICRO
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cachedInContext: true,
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
      }),
      securityGroup,
      instanceProfile,
      userData,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      keyPair: ec2.KeyPair.fromKeyPairName(
        this,
        "KeyPair",
        "milestone-primary"
      ),
      userDataCausesReplacement: true,
    });

    this.instanceId = this.instance.instanceId;

    this.distribution = new cloudfront.Distribution(
      this,
      "MilestoneDistribution",
      {
        defaultBehavior: {
          origin: new origins.HttpOrigin(this.instance.instancePublicDnsName, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          }),
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        defaultRootObject: "",
        enableLogging: false,
        comment: stack.stackName,
      }
    );

    const appEnvParameters = [
      {
        envVar: "DATABASE_URL",
        parameterName: "/milestone/db-url-staging-one",
        secure: true,
      },
      {
        envVar: "JWT_SECRET",
        parameterName: "/milestone/jwt-secret",
        secure: true,
      },
      {
        envVar: "REFRESH_TOKEN_SECRET",
        parameterName: "/milestone/refresh_token_secret",
        secure: true,
      },
      {
        envVar: "COOKIE_SECRET",
        parameterName: "/milestone/cookie_secret",
        secure: true,
      },
      {
        envVar: "TRADING_212_API_KEY",
        parameterName: "/milestone/trading_212_api_key",
        secure: true,
      },
      {
        envVar: "ALPHA_VANTAGE_API_KEY",
        parameterName: "/milestone/alpha_vantage_api_key",
        secure: true,
      },
      {
        envVar: "EODHD_API_KEY",
        parameterName: "/milestone/eodhd_api_key",
        secure: true,
      },
      {
        envVar: "ACCESS_TOKEN_EXPIRY",
        parameterName: "/milestone/access_token_expiry",
        secure: false,
      },
      {
        envVar: "REFRESH_TOKEN_EXPIRY",
        parameterName: "/milestone/refresh_token_expiry",
        secure: false,
      },
    ];

    const envFetchCommands = appEnvParameters
      .map((param) => {
        const secureFlag = param.secure ? "true" : "false";
        return `  fetch_param "${param.parameterName}" "${param.envVar}" "${secureFlag}"`;
      })
      .join("\n");

    const envFetchBody =
      envFetchCommands.length > 0
        ? `${envFetchCommands}
`
        : "";

    const deployScript = `#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/opt/milestone"
ENV_FILE="$APP_ROOT/.env"
GHCR_USERNAME=$(aws ssm get-parameter --name "/milestone/github-username" --query 'Parameter.Value' --output text)
DEFAULT_IMAGE="ghcr.io/\${GHCR_USERNAME}/${imageName}"
TARGET_IMAGE="\${1:-\${DEFAULT_IMAGE}}"
LOG(){ echo "[$(date --iso-8601=seconds)] [DEPLOY] $1"; }
STACK_NAME="${stack.stackName}"

fetch_param() {
  local parameter_name="$1"
  local env_key="$2"
  local secure_flag="$3"
  local cmd=(aws ssm get-parameter --name "$parameter_name" --query 'Parameter.Value' --output text)
  if [[ "$secure_flag" == "true" ]]; then
    cmd+=(--with-decryption)
  fi
  if value=$("\${cmd[@]}" 2>/dev/null); then
    echo "$env_key=$value" >> "$ENV_FILE"
  else
    LOG "WARN unable to fetch $parameter_name (env: $env_key)"
  fi
}

write_default() {
  local key="$1"
  local fallback="$2"
  if ! grep -q "^\${key}=" "$ENV_FILE" 2>/dev/null; then
    echo "$key=$fallback" >> "$ENV_FILE"
  fi
}

set_env_value() {
  local key="$1"
  local value="$2"
  if grep -q "^$key=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^$key=.*|$key=$value|" "$ENV_FILE"
  else
    echo "$key=$value" >> "$ENV_FILE"
  fi
}

resolve_cloudfront_domain() {
  local attempts=0
  local domain="None"
  while [[ $attempts -lt 30 ]]; do
    domain=$(aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='${stack.stackName}'].DomainName | [0]" --output text 2>/dev/null || echo "None")
    if [[ -n "$domain" && "$domain" != "None" ]]; then
      echo "$domain"
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 10
  done
  echo ""
}

refresh_env_file() {
  rm -f "$ENV_FILE"
  touch "$ENV_FILE"
  chmod 600 "$ENV_FILE"
${envFetchBody}  write_default "ACCESS_TOKEN_EXPIRY" "15m"
  write_default "REFRESH_TOKEN_EXPIRY" "30d"
  write_default "APP_IMAGE" "$DEFAULT_IMAGE"
  # TEMPORARY: Force cookie domain to CloudFront distribution while custom domain/SSL is pending.
  local cf_domain
  cf_domain=$(resolve_cloudfront_domain)
  if [[ -n "$cf_domain" ]]; then
    set_env_value "COOKIE_DOMAIN" "$cf_domain"
  else
    LOG "WARN unable to resolve CloudFront domain; COOKIE_DOMAIN unchanged"
  fi
}

update_app_image() {
  local new_image="$1"
  if [[ -z "$new_image" ]]; then
    new_image="$DEFAULT_IMAGE"
  fi
  set_env_value "APP_IMAGE" "$new_image"
}

login_ghcr() {
  local token
  token=$(aws ssm get-parameter --name "/milestone/github-token" --with-decryption --query 'Parameter.Value' --output text 2>/dev/null || echo "")
  local username
  username=$(aws ssm get-parameter --name "/milestone/github-username" --query 'Parameter.Value' --output text 2>/dev/null || echo "")
  if [[ -n "$token" && -n "$username" ]]; then
    echo "$token" | docker login ghcr.io -u "$username" --password-stdin >/dev/null 2>&1 || true
  elif [[ -n "$token" ]]; then
    echo "$token" | docker login ghcr.io --username "token" --password-stdin >/dev/null 2>&1 || true
  else
    LOG "WARN missing GitHub token for GHCR login"
  fi
}

deploy() {
  LOG "Refreshing environment variables"
  refresh_env_file
  LOG "Ensuring APP_IMAGE is up to date"
  update_app_image "$TARGET_IMAGE"
  LOG "Authenticating with GHCR"
  login_ghcr
  LOG "Updating containers"
  cd "$APP_ROOT"
  docker-compose pull
  docker-compose up -d
  docker-compose ps
}

deploy
`;

    userData.addCommands(
      "mkdir -p /opt/milestone/bin",
      `cat > /opt/milestone/bin/deploy.sh << 'EOF'
${deployScript}
EOF`,
      "chmod +x /opt/milestone/bin/deploy.sh",
      "chown -R ec2-user:ec2-user /opt/milestone",
      `runuser -l ec2-user -c "/opt/milestone/bin/deploy.sh \${DEFAULT_IMAGE}"`
    );

    // Output useful information
    new cdk.CfnOutput(this, "InstanceId", {
      value: this.instanceId,
      description: "EC2 Instance ID",
    });

    new cdk.CfnOutput(this, "InstancePublicIp", {
      value: this.instance.instancePublicIp,
      description: "EC2 Instance Public IP",
    });

    new cdk.CfnOutput(this, "SSMCommand", {
      value: `aws ssm send-command --instance-ids ${this.instanceId} --document-name "AWS-RunShellScript" --parameters 'commands=["/opt/milestone/bin/deploy.sh ghcr.io/owner/repo:tag"]'`,
      description:
        "Example SSM command to deploy a specific image via the host script",
    });

    new cdk.CfnOutput(this, "CloudFrontDomain", {
      value: this.distribution.domainName,
      description: "CloudFront distribution domain name",
    });
  }
}
