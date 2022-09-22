#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { FlowLogStack } from "../lib/flow-logs-stack";
import { Ec2Stack } from "../lib/ec2-stack";
import CONFIG from "./../config.json";

const app = new cdk.App();

new Ec2Stack(app, "Ec2Stack", {
  vpcId: CONFIG.VPC_ID,
  vpcName: CONFIG.VPC_NAME,
  env: {
    region: "us-east-1",
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});
new FlowLogStack(app, "FlowLogStack", {
  vpcId: CONFIG.VPC_ID,
  vpcName: CONFIG.VPC_NAME,
  interfaceId: "eni-0fafc042c5f32c0fe",
  env: {
    region: "us-east-1",
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});
