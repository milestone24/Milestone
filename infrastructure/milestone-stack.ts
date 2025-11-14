import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { MilestoneAppConstruct } from "./milestone-app-construct.ts";

export interface MilestoneStackProps extends cdk.StackProps {
  /**
   * GitHub Container Registry image name (e.g., ghcr.io/username/repo)
   * @default - Must be provided
   */
  imageName?: string;
}

export class MilestoneStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: MilestoneStackProps) {
    super(scope, id, props);

    new MilestoneAppConstruct(this, "MilestoneApp", {
      imageName: props?.imageName,
    });
  }
}
