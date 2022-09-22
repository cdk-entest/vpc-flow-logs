import { Stack, StackProps, aws_ec2, aws_iam } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Effect } from "aws-cdk-lib/aws-iam";

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
