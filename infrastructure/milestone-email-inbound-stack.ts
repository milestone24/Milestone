import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ses from "aws-cdk-lib/aws-ses";
import * as sesActions from "aws-cdk-lib/aws-ses-actions";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from "aws-cdk-lib/custom-resources";
import type { Construct } from "constructs";
import {
  EMAIL_INBOUND_LOCAL_PART_PREFIX_PARAMETER_NAME,
  EMAIL_INBOUND_RAIL_DEFINITIONS,
  EMAIL_INBOUND_S3_BUCKET_PARAMETER_NAME,
  emailInboundMailFqdnParameterName,
  emailInboundSnsTopicArnParameterName,
  emailInboundSqsQueueUrlParameterName,
} from "./ssm-email-inbound.ts";

/**
 * Stable S3 bucket name for raw inbound mail (RFC822). Must be globally unique
 * per AWS account. Assigned to the raw-mail bucket in
 * {@link MilestoneEmailInboundStack}.
 */
export const MILESTONE_EMAIL_INBOUND_BUCKET_NAME = "milestone.email-inbound";

export interface MilestoneEmailInboundStackProps extends cdk.StackProps {
  /** Route 53 public hosted zone ID that owns DNS for {@link hostedZoneName}. */
  readonly hostedZoneId: string;
  /** Route 53 zone apex (e.g. `milestone.gaari.me`). */
  readonly hostedZoneName: string;
}

export interface MilestoneEmailInboundRailResources {
  readonly mailSubdomain: string;
  readonly mailFqdn: string;
  readonly notificationTopic: sns.Topic;
  readonly notificationQueue: sqs.Queue;
}

function dkimCnameTarget(value: string): string {
  return value.endsWith(".") ? value : `${value}.`;
}

function cdkIdSuffixFromMailSubdomain(mailSubdomain: string): string {
  return mailSubdomain.replace(/[^A-Za-z0-9]/g, "");
}

/** Publishes SES Easy DKIM CNAME tokens into the given hosted zone. */
function addDkimCnameRecord(
  scope: Construct,
  constructIdPrefix: string,
  hostedZoneId: string,
  index: number,
  record: { name: string; value: string },
): void {
  new route53.CfnRecordSet(scope, `${constructIdPrefix}InboundDkim${index}`, {
    hostedZoneId,
    name: record.name,
    type: "CNAME",
    ttl: "1800",
    resourceRecords: [dkimCnameTarget(record.value)],
  });
}

/**
 * Document inbound email: SES receive → S3 (raw RFC822) + SNS when stored,
 * then **SNS → SQS** per environment rail. Three FQDNs under the zone (prod,
 * staging, dev) share one bucket and one receipt rule set; each rail has its
 * own SNS topic, SQS queue, and S3 object prefix. No CDK dependencies on other
 * Milestone stacks.
 */
export class MilestoneEmailInboundStack extends cdk.Stack {
  public readonly rawMailBucket: s3.Bucket;
  public readonly emailInboundRails: readonly MilestoneEmailInboundRailResources[];

  constructor(scope: Construct, id: string, props: MilestoneEmailInboundStackProps) {
    super(scope, id, props);

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
      this,
      "InboundMailHostedZone",
      {
        hostedZoneId: props.hostedZoneId,
        zoneName: props.hostedZoneName,
      },
    );

    this.rawMailBucket = new s3.Bucket(this, "RawInboundMail", {
      bucketName: MILESTONE_EMAIL_INBOUND_BUCKET_NAME,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const ruleSet = new ses.ReceiptRuleSet(this, "InboundReceiptRuleSet", {
      receiptRuleSetName: "milestone-email-inbound",
    });

    const rails: MilestoneEmailInboundRailResources[] = [];

    for (const rail of EMAIL_INBOUND_RAIL_DEFINITIONS) {
      const idSuffix = cdkIdSuffixFromMailSubdomain(rail.mailSubdomain);
      const mailFqdn = `${rail.mailSubdomain}.${props.hostedZoneName}`;
      const objectKeyPrefix = `raw/${rail.mailSubdomain}/`;

      const notificationTopic = new sns.Topic(
        this,
        `InboundMailTopic${idSuffix}`,
        {
          displayName: `Milestone inbound mail (${rail.mailSubdomain})`,
        },
      );

      notificationTopic.addToResourcePolicy(
        new iam.PolicyStatement({
          sid: `AllowSesPublishInbound${idSuffix}`,
          effect: iam.Effect.ALLOW,
          principals: [new iam.ServicePrincipal("ses.amazonaws.com")],
          actions: ["sns:Publish"],
          resources: [notificationTopic.topicArn],
        }),
      );

      const notificationQueue = new sqs.Queue(
        this,
        `InboundMailNotifyQueue${idSuffix}`,
        {
          queueName: rail.queueName,
          encryption: sqs.QueueEncryption.SQS_MANAGED,
          visibilityTimeout: cdk.Duration.minutes(5),
          receiveMessageWaitTime: cdk.Duration.seconds(20),
          retentionPeriod: cdk.Duration.days(14),
        },
      );

      notificationTopic.addSubscription(
        new subs.SqsSubscription(notificationQueue),
      );

      const emailIdentity = new ses.EmailIdentity(
        this,
        `InboundMailIdentity${idSuffix}`,
        {
          identity: ses.Identity.domain(mailFqdn),
        },
      );

      for (let i = 0; i < emailIdentity.dkimRecords.length; i += 1) {
        const record = emailIdentity.dkimRecords[i];
        if (!record) {
          continue;
        }
        addDkimCnameRecord(
          this,
          `${idSuffix}`,
          hostedZone.hostedZoneId,
          i,
          record,
        );
      }

      new route53.MxRecord(this, `SesInboundMx${idSuffix}`, {
        zone: hostedZone,
        recordName: rail.mailSubdomain,
        values: [
          {
            priority: 10,
            hostName: `inbound-smtp.${cdk.Aws.REGION}.amazonaws.com`,
          },
        ],
      });

      ruleSet.addRule(`StoreRawAndNotify${idSuffix}`, {
        recipients: [mailFqdn],
        actions: [
          new sesActions.S3({
            bucket: this.rawMailBucket,
            objectKeyPrefix,
            topic: notificationTopic,
          }),
        ],
      });

      new ssm.StringParameter(this, `EmailInboundSnsTopicArnParam${idSuffix}`, {
        parameterName: emailInboundSnsTopicArnParameterName(rail.mailSubdomain),
        stringValue: notificationTopic.topicArn,
      });

      new ssm.StringParameter(this, `EmailInboundSqsQueueUrlParam${idSuffix}`, {
        parameterName: emailInboundSqsQueueUrlParameterName(rail.mailSubdomain),
        stringValue: notificationQueue.queueUrl,
      });

      new ssm.StringParameter(this, `EmailInboundMailFqdnParam${idSuffix}`, {
        parameterName: emailInboundMailFqdnParameterName(rail.mailSubdomain),
        stringValue: mailFqdn,
      });

      new cdk.CfnOutput(this, `InboundMailFqdn${idSuffix}`, {
        value: mailFqdn,
        description: `Inbound host for rail ${rail.mailSubdomain} (MX + SES)`,
      });

      new cdk.CfnOutput(this, `InboundNotificationTopicArn${idSuffix}`, {
        value: notificationTopic.topicArn,
        description: `SNS topic for ${rail.mailSubdomain} after S3 store`,
      });

      new cdk.CfnOutput(this, `InboundNotificationQueueUrl${idSuffix}`, {
        value: notificationQueue.queueUrl,
        description: `SQS queue URL for ${rail.mailSubdomain} (SNS subscription)`,
      });

      rails.push({
        mailSubdomain: rail.mailSubdomain,
        mailFqdn,
        notificationTopic,
        notificationQueue,
      });
    }

    this.emailInboundRails = rails;

    const activateRuleSet = new AwsCustomResource(this, "ActivateInboundRuleSet", {
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
      onCreate: {
        service: "SES",
        action: "setActiveReceiptRuleSet",
        parameters: { RuleSetName: ruleSet.receiptRuleSetName },
        physicalResourceId: PhysicalResourceId.of(
          `ses-active-ruleset-${ruleSet.receiptRuleSetName}`,
        ),
      },
      onUpdate: {
        service: "SES",
        action: "setActiveReceiptRuleSet",
        parameters: { RuleSetName: ruleSet.receiptRuleSetName },
        physicalResourceId: PhysicalResourceId.of(
          `ses-active-ruleset-${ruleSet.receiptRuleSetName}`,
        ),
      },
      onDelete: {
        service: "SES",
        action: "setActiveReceiptRuleSet",
        parameters: { RuleSetName: "" },
        physicalResourceId: PhysicalResourceId.of(
          `ses-active-ruleset-${ruleSet.receiptRuleSetName}`,
        ),
      },
    });
    activateRuleSet.node.addDependency(ruleSet);

    new ssm.StringParameter(this, "EmailInboundS3BucketParam", {
      parameterName: EMAIL_INBOUND_S3_BUCKET_PARAMETER_NAME,
      stringValue: this.rawMailBucket.bucketName,
    });

    new ssm.StringParameter(this, "EmailInboundLocalPartPrefixParam", {
      parameterName: EMAIL_INBOUND_LOCAL_PART_PREFIX_PARAMETER_NAME,
      stringValue: "ingest",
      description:
        "Local-part prefix for routing addresses (ingest+{shortCode}@mail-fqdn); change only with worker/parser updates",
    });

    new cdk.CfnOutput(this, "RawInboundMailBucketName", {
      value: this.rawMailBucket.bucketName,
      description:
        "S3 bucket for raw inbound messages (RFC822; same name as MILESTONE_EMAIL_INBOUND_BUCKET_NAME)",
    });
  }
}
