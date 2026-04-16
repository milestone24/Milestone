#!/usr/bin/env node
import "source-map-support/register.js";
import * as cdk from "aws-cdk-lib";
import { MilestoneRuntimeStack } from "./milestone-runtime-stack.ts";
import { MilestoneStack } from "./milestone-stack.ts";

const app = new cdk.App();

function resolveStackEnvironment(): cdk.Environment {
  const account = process.env.CDK_DEFAULT_ACCOUNT;
  const region = process.env.CDK_DEFAULT_REGION;
  if (!account || !region) {
    throw new Error(
      "CDK stacks need CDK_DEFAULT_ACCOUNT and CDK_DEFAULT_REGION. The CDK CLI sets these when you run with an AWS profile (e.g. cdk synth --profile firemedia.gary). No region is hardcoded in app.ts.",
    );
  }
  return { account, region };
}

const stackEnv = resolveStackEnvironment();

new MilestoneRuntimeStack(app, "MilestoneRuntimeStack", {
  env: stackEnv,
  description:
    "Milestone runtime: S3 documents bucket and SSM bucket name parameter",
});

new MilestoneStack(app, "MilestoneStack", {
  env: stackEnv,
  description: "Milestone investment tracking application infrastructure",
  // You can pass the imageName here when deploying:
  imageName: "milestone-staging:latest",
});
