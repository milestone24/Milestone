#!/usr/bin/env node
import "source-map-support/register.js";
import * as cdk from "aws-cdk-lib";
import { MilestoneStack } from "./milestone-stack.ts";

const app = new cdk.App();

new MilestoneStack(app, "MilestoneStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-east-1",
  },
  description: "Milestone investment tracking application infrastructure",
  // You can pass the imageName here when deploying:
  imageName: "milestone-staging:latest",
});
