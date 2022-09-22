import {
  Stack,
  StackProps,
  aws_ec2,
  aws_iam,
  aws_logs,
  RemovalPolicy,
  aws_cloudwatch,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { Effect } from "aws-cdk-lib/aws-iam";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import * as path from "path";
import * as fs from "fs";

interface VpcFlowLogsProps extends StackProps {
  vpcId: string;
  vpcName: string;
  interfaceId: string;
}

export class FlowLogStack extends Stack {
  constructor(scope: Construct, id: string, props: VpcFlowLogsProps) {
    super(scope, id, props);

    // ===================== FlowLogs ==========================
    // cloudwatch log group
    const logGroup = new aws_logs.LogGroup(this, "Ec2FlowLogLogGroup", {
      logGroupName: "Ec2FlowLogLogGroup",
      retention: RetentionDays.ONE_DAY,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    // role for flowlogs to publish to log group
    const roleForFlowLog = new aws_iam.Role(
      this,
      "RoleForFlowLogPublishToLogGroup",
      {
        roleName: "RoleForFlowLogPublishToLogGroup",
        assumedBy: new aws_iam.ServicePrincipal("vpc-flow-logs.amazonaws.com"),
      }
    );
    roleForFlowLog.addToPolicy(
      new aws_iam.PolicyStatement({
        effect: Effect.ALLOW,
        resources: [logGroup.logGroupArn],
        actions: ["logs:*"],
      })
    );
    // flowlogs to monitor the ec2 network interface
    new aws_ec2.CfnFlowLog(this, "Ec2FlowLog", {
      resourceId: props.interfaceId,
      resourceType: "NetworkInterface",
      trafficType: "ALL",
      deliverLogsPermissionArn: roleForFlowLog.roleArn,
      logGroupName: logGroup.logGroupName,
      maxAggregationInterval: 60,
    });
    // ===================== CloudWatch InsightRule ======================
    const dataTransferRule = new aws_cloudwatch.CfnInsightRule(
      this,
      "DataTransferMonitorRule",
      {
        ruleName: "DataTransferMonitorRule",
        ruleBody: fs.readFileSync(
          path.resolve(__dirname, "./../rules/data_transfer_rule.json"),
          { encoding: "utf-8" }
        ),
        ruleState: "ENABLED",
      }
    );

    dataTransferRule.node.addDependency(logGroup);

    // ===================== CloudWatch Metrics ==========================
    // filter accept request
    const filterAccept = new aws_logs.MetricFilter(
      this,
      "FilterAcceptFlowLog",
      {
        logGroup,
        metricNamespace: "FlowLogFilter",
        metricName: "Accept",
        filterPattern: aws_logs.FilterPattern.spaceDelimited(
          "version",
          "accountid",
          "interfaceid",
          "srcaddr",
          "dstaddr",
          "srcport",
          "dstport",
          "protocol",
          "packets",
          "bytes",
          "start",
          "end",
          "action",
          "logstatus"
        ).whereString("action", "=", "ACCEPT"),
        metricValue: "$bytes",
        defaultValue: 0,
      }
    );
    const metricAccept = filterAccept.metric();
    // filter accept request
    const filterReject = new aws_logs.MetricFilter(
      this,
      "FilterRejectFlowLog",
      {
        logGroup,
        metricNamespace: "FlowLogFilter",
        metricName: "Reject",
        filterPattern: aws_logs.FilterPattern.spaceDelimited(
          "version",
          "accountid",
          "interfaceid",
          "srcaddr",
          "dstaddr",
          "srcport",
          "dstport",
          "protocol",
          "packets",
          "bytes",
          "start",
          "end",
          "action",
          "logstatus"
        ).whereString("action", "=", "REJECT"),
        metricValue: "$bytes",
        defaultValue: 0,
      }
    );
    const metricReject = filterReject.metric();
  }
}
