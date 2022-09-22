import {
  Stack,
  StackProps,
  aws_ec2,
  aws_iam,
  aws_logs,
  RemovalPolicy,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { Effect } from "aws-cdk-lib/aws-iam";
import { RetentionDays } from "aws-cdk-lib/aws-logs";

interface VpcFlowLogsProps extends StackProps {
  vpcId: string;
  vpcName: string;
  interfaceId: string;
}

interface Ec2StackProps extends StackProps {
  vpcId: string;
  vpcName: string;
}

export class Ec2Stack extends Stack {
  constructor(scope: Construct, id: string, props: Ec2StackProps) {
    super(scope, id, props);

    // lookup existing vpc
    const vpc = aws_ec2.Vpc.fromLookup(this, "existingVpc", {
      vpcId: props.vpcId,
      vpcName: props.vpcName,
    });

    const role = new aws_iam.Role(this, "RoleForEc2AccessSSM", {
      assumedBy: new aws_iam.ServicePrincipal("ec2.amazonaws.com"),
      roleName: "RoleForEc2AccessSSM",
    });

    role.addManagedPolicy(
      aws_iam.ManagedPolicy.fromManagedPolicyArn(
        this,
        "PolicySSMAccessS3",
        "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
      )
    );

    role.addToPolicy(
      new aws_iam.PolicyStatement({
        effect: Effect.ALLOW,
        resources: ["*"],
        actions: ["s3:*"],
      })
    );

    new aws_ec2.Instance(this, "Ec2Test", {
      instanceName: "Ec2Test",
      vpc: vpc,
      role: role,
      vpcSubnets: {
        subnetType: aws_ec2.SubnetType.PUBLIC,
      },
      instanceType: aws_ec2.InstanceType.of(
        aws_ec2.InstanceClass.T3,
        aws_ec2.InstanceSize.SMALL
      ),
      machineImage: new aws_ec2.AmazonLinuxImage({
        generation: aws_ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
        edition: aws_ec2.AmazonLinuxEdition.STANDARD,
      }),
      allowAllOutbound: true,
    });
  }
}

export class FlowLogStack extends Stack {
  constructor(scope: Construct, id: string, props: VpcFlowLogsProps) {
    super(scope, id, props);

    // cloudwatch log group
    const logGroup = new aws_logs.LogGroup(this, "Ec2FlowLogLogGroup", {
      logGroupName: "Ec2FlowLogLogGroup",
      retention: RetentionDays.ONE_DAY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

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

    // alarm  actions based on metrics

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
  }
}
