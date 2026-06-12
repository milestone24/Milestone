import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { MilestoneAppConstruct } from "./milestone-app-construct.ts";

export interface MilestoneStackProps extends cdk.StackProps {
  /**
   * GitHub Container Registry image name (e.g., ghcr.io/username/repo)
   * @default - Must be provided
   */
  imageName?: string;
  /**
   * Which inbound-mail rail this instance consumes from SSM (`doc-inbound` |
   * `doc-inbound-staging` | `doc-inbound-dev`). Set via CDK context
   * `emailInboundMailSubdomain` in `app.ts` when synthesizing a non-prod stack.
   */
  emailInboundMailSubdomain?: string;
}

export class MilestoneStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: MilestoneStackProps) {
    super(scope, id, props);

    new MilestoneAppConstruct(this, "MilestoneApp", {
      imageName: props?.imageName,
      emailInboundMailSubdomain: props?.emailInboundMailSubdomain,
    });
  }
}
