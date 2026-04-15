#!/usr/bin/env node
import "source-map-support/register.js";
import * as cdk from "aws-cdk-lib";
import { MilestoneRuntimeStack } from "./milestone-runtime-stack.ts";
import { MilestoneStack } from "./milestone-stack.ts";

const app = new cdk.App();

const stackEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || "us-east-1",
};

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
