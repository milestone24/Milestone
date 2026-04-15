import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ssm from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";
import { DOCUMENTS_S3_BUCKET_PARAMETER_NAME } from "./ssm-documents-bucket.ts";

export class MilestoneRuntimeStack extends cdk.Stack {
  public readonly documentsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.documentsBucket = new s3.Bucket(this, "DocumentsBucket", {
      bucketName: "milestone.documents",
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new ssm.StringParameter(this, "DocumentsBucketNameParameter", {
      parameterName: DOCUMENTS_S3_BUCKET_PARAMETER_NAME,
      stringValue: this.documentsBucket.bucketName,
    });

    new cdk.CfnOutput(this, "DocumentsBucketName", {
      value: this.documentsBucket.bucketName,
      description: "Documents S3 bucket name",
    });

    new cdk.CfnOutput(this, "DocumentsSsmParameterName", {
      value: DOCUMENTS_S3_BUCKET_PARAMETER_NAME,
      description: "SSM parameter containing the documents bucket name",
    });
  }
}
