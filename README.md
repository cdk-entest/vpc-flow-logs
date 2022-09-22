---
title: Introduction to VPC FlowLogs
author: haimtran
publishedDate: 20/09/2022
date: 20/09/2022
---

## Introduction

[GitHub]() this shows an example using vpc flowlogs to monitor network traffic in/out of a network interface.

- create flowlogs and loggroup
- filter the flowlogs and create metric
- cloudwatch insightrule - top contribute network traffic

## FlowLogs and LogGroup

assume we want to monitor a network interface (EC2, VPC, NAT)

```tsx
interface VpcFlowLogsProps extends StackProps {
  vpcId: string;
  vpcName: string;
  interfaceId: string;
}
```

create a log group to store flow logs

```tsx
// cloudwatch log group
const logGroup = new aws_logs.LogGroup(this, "Ec2FlowLogLogGroup", {
  logGroupName: "Ec2FlowLogLogGroup",
  retention: RetentionDays.ONE_DAY,
  removalPolicy: RemovalPolicy.DESTROY,
});
```

create flow logs applied in a network interface

```tsx
new aws_ec2.CfnFlowLog(this, "Ec2FlowLog", {
  resourceId: props.interfaceId,
  resourceType: "NetworkInterface",
  trafficType: "ALL",
  deliverLogsPermissionArn: roleForFlowLog.roleArn,
  logGroupName: logGroup.logGroupName,
  maxAggregationInterval: 60,
});
```

role for flow logs to publish log into log group

```tsx
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
```

## Filter FlowLogs

filter ACCEPT request

```tsx
const filterAccept = new aws_logs.MetricFilter(this, "FilterAcceptFlowLog", {
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
});
const metricAccept = filterAccept.metric();
```

similar to filter REJECT request

```tsx
const filterReject = new aws_logs.MetricFilter(this, "FilterRejectFlowLog", {
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
});
const metricReject = filterReject.metric();
```

## CloudWatch InsightRule

to find top contributors (for example top source ip address) which contribute the most data traffic, we can use cloudwatch insight rule

```tsx
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
```
