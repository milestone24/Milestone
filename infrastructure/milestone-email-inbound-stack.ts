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
  EMAIL_INBOUND_MAIL_FQDN_PARAMETER_NAME,
  EMAIL_INBOUND_NOTIFY_QUEUE_NAME,
  EMAIL_INBOUND_S3_BUCKET_PARAMETER_NAME,
  EMAIL_INBOUND_SNS_TOPIC_ARN_PARAMETER_NAME,
  EMAIL_INBOUND_SQS_QUEUE_URL_PARAMETER_NAME,
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
  /**
   * First DNS label under {@link hostedZoneName} for MX + SES identity
   * (e.g. `doc-inbound` → `doc-inbound.milestone.gaari.me`). Override via CDK
   * context `emailInboundMailSubdomain` in the CDK `app.ts` entry if needed.
   */
  readonly mailSubdomain: string;
}

function dkimCnameTarget(value: string): string {
  return value.endsWith(".") ? value : `${value}.`;
}

/** Publishes SES Easy DKIM CNAME tokens into the given hosted zone. */
function addDkimCnameRecord(
  scope: Construct,
  hostedZoneId: string,
  index: number,
  record: { name: string; value: string },
): void {
  new route53.CfnRecordSet(scope, `InboundDkim${index}`, {
    hostedZoneId,
    name: record.name,
    type: "CNAME",
    ttl: "1800",
    resourceRecords: [dkimCnameTarget(record.value)],
  });
}

/**
 * Document inbound email rail only: SES receive → S3 (raw RFC822) + SNS when
 * stored, then **SNS → SQS** so multiple workers can long-poll the same queue.
 * DNS uses {@link MilestoneEmailInboundStackProps.mailSubdomain} under the
 * imported zone (default from app: `doc-inbound` on `milestone.gaari.me`). Raw
 * objects use bucket {@link MILESTONE_EMAIL_INBOUND_BUCKET_NAME}. No CDK
 * dependencies on other Milestone stacks.
 */
export class MilestoneEmailInboundStack extends cdk.Stack {
  public readonly rawMailBucket: s3.Bucket;
  public readonly inboundNotificationTopic: sns.Topic;
  public readonly inboundNotificationQueue: sqs.Queue;

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

    const mailFqdn = `${props.mailSubdomain}.${props.hostedZoneName}`;

    this.rawMailBucket = new s3.Bucket(this, "RawInboundMail", {
      bucketName: MILESTONE_EMAIL_INBOUND_BUCKET_NAME,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.inboundNotificationTopic = new sns.Topic(this, "InboundMailTopic", {
      displayName: "Milestone inbound mail (SES)",
    });

    this.inboundNotificationTopic.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowSesPublishInbound",
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("ses.amazonaws.com")],
        actions: ["sns:Publish"],
        resources: [this.inboundNotificationTopic.topicArn],
      }),
    );

    this.inboundNotificationQueue = new sqs.Queue(this, "InboundMailNotifyQueue", {
      queueName: EMAIL_INBOUND_NOTIFY_QUEUE_NAME,
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      visibilityTimeout: cdk.Duration.minutes(5),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      retentionPeriod: cdk.Duration.days(14),
    });

    this.inboundNotificationTopic.addSubscription(
      new subs.SqsSubscription(this.inboundNotificationQueue),
    );

    const emailIdentity = new ses.EmailIdentity(this, "InboundMailIdentity", {
      identity: ses.Identity.domain(mailFqdn),
    });

    for (let i = 0; i < emailIdentity.dkimRecords.length; i += 1) {
      const record = emailIdentity.dkimRecords[i];
      if (!record) {
        continue;
      }
      addDkimCnameRecord(this, hostedZone.hostedZoneId, i, record);
    }

    new route53.MxRecord(this, "SesInboundMx", {
      zone: hostedZone,
      recordName: props.mailSubdomain,
      values: [
        {
          priority: 10,
          hostName: `inbound-smtp.${cdk.Aws.REGION}.amazonaws.com`,
        },
      ],
    });

    const ruleSet = new ses.ReceiptRuleSet(this, "InboundReceiptRuleSet", {
      receiptRuleSetName: "milestone-email-inbound",
    });

    ruleSet.addRule("StoreRawAndNotify", {
      recipients: [mailFqdn],
      actions: [
        new sesActions.S3({
          bucket: this.rawMailBucket,
          objectKeyPrefix: "raw/",
          topic: this.inboundNotificationTopic,
        }),
      ],
    });

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

    new ssm.StringParameter(this, "EmailInboundSnsTopicArnParam", {
      parameterName: EMAIL_INBOUND_SNS_TOPIC_ARN_PARAMETER_NAME,
      stringValue: this.inboundNotificationTopic.topicArn,
    });

    new ssm.StringParameter(this, "EmailInboundSqsQueueUrlParam", {
      parameterName: EMAIL_INBOUND_SQS_QUEUE_URL_PARAMETER_NAME,
      stringValue: this.inboundNotificationQueue.queueUrl,
    });

    new ssm.StringParameter(this, "EmailInboundMailFqdnParam", {
      parameterName: EMAIL_INBOUND_MAIL_FQDN_PARAMETER_NAME,
      stringValue: mailFqdn,
    });

    new cdk.CfnOutput(this, "InboundMailFqdn", {
      value: mailFqdn,
      description:
        "Document inbound host: MX + SES domain identity (e.g. doc-inbound.milestone.gaari.me)",
    });

    new cdk.CfnOutput(this, "RawInboundMailBucketName", {
      value: this.rawMailBucket.bucketName,
      description:
        "S3 bucket for raw inbound messages (RFC822; same name as MILESTONE_EMAIL_INBOUND_BUCKET_NAME)",
    });

    new cdk.CfnOutput(this, "InboundNotificationTopicArn", {
      value: this.inboundNotificationTopic.topicArn,
      description:
        "SNS topic SES publishes to after the receipt-rule S3 store action completes",
    });

    new cdk.CfnOutput(this, "InboundNotificationQueueUrl", {
      value: this.inboundNotificationQueue.queueUrl,
      description:
        "SQS queue URL subscribed to the inbound SNS topic (horizontal workers)",
    });
  }
}
