# Amazon IVS Real-time Serverless Demo

A serverless demo intended as an educational tool to demonstrate how you can build an application that enables real-time social UGC (User Generated Content) use cases using Amazon IVS Stages and Amazon IVS Chat. This README includes instructions for deploying the Amazon IVS Real-time Serverless demo to an AWS Account.

_IMPORTANT NOTE: Deploying this demo application in your AWS account will create and consume AWS resources, which will cost money._

## Prerequisites

- [AWS CLI Version 2](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)
- [NodeJS](https://nodejs.org/en/) and `npm` (npm is usually installed with NodeJS)
  - If you have [node version manager](https://github.com/nvm-sh/nvm) installed, run `nvm use` to sync your node version with this project
- Access to an AWS Account with at least the following permissions:
  - Create IAM Roles
  - Create Lambda Functions
  - Create Secret Manager Secrets
  - Create Amazon IVS Stages and Chat Rooms
  - Create Amazon DynamoDB Tables
  - Create EventBridge Rules
  - Create Step Functions State Machines

For configuration specifics, refer to the [AWS CLI User Guide](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html).

## Architecture

![Architecture Diagram](architecture.png)

## One-click deploy

1. Click the **Launch stack** button that corresponds to the region that is geographically closest to you

   | **North America**       |                                                                                                                                                                                                                                                                                                                                                                                   |
   | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | us-east-1 (N. Virginia) | [![Launch Stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/new?stackName=IVSRealTimeDemo&templateURL=https://ivs-demos-cf-stacks-us-east-1.s3.us-east-1.amazonaws.com/IVSRealTimeDemo/e7eec401ffa765ea523e56f3977c607f4883045bf0db900cd9cc98fca70aae36.json) |
   | us-west-2 (Oregon)      | [![Launch Stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home?region=us-west-2#/stacks/new?stackName=IVSRealTimeDemo&templateURL=https://ivs-demos-cf-stacks-us-west-2.s3.us-west-2.amazonaws.com/IVSRealTimeDemo/f664fe34283c416d57dc1bb728916651d8fd51da1ec4608dbf125e1a06a086cf.json) |

   | **Europe**               |                                                                                                                                                                                                                                                                                                                                                                                            |
   | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | eu-west-1 (Ireland)      | [![Launch Stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home?region=eu-west-1#/stacks/new?stackName=IVSRealTimeDemo&templateURL=https://ivs-demos-cf-stacks-eu-west-1.s3.eu-west-1.amazonaws.com/IVSRealTimeDemo/c989e41afa054ac247a93d724087fea4a44b1044745efcd63f7d7e4c2297c511.json)          |
   | eu-central-1 (Frankfurt) | [![Launch Stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home?region=eu-central-1#/stacks/new?stackName=IVSRealTimeDemo&templateURL=https://ivs-demos-cf-stacks-eu-central-1.s3.eu-central-1.amazonaws.com/IVSRealTimeDemo/c76a1ca14931a8077724e676e07bc4c695ff13331f2aceb4edfcf8d2af6bdf64.json) |

   | **Asia Pacific**       |                                                                                                                                                                                                                                                                                                                                                                                                  |
   | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | ap-south-1 (Mumbai)    | [![Launch Stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home?region=ap-south-1#/stacks/new?stackName=IVSRealTimeDemo&templateURL=https://ivs-demos-cf-stacks-ap-south-1.s3.ap-south-1.amazonaws.com/IVSRealTimeDemo/be3e5b0c8ff94beff685c83dac2293521bd73ed43f6faef869f079ef339b02d7.json)             |
   | ap-northeast-1 (Tokyo) | [![Launch Stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home?region=ap-northeast-1#/stacks/new?stackName=IVSRealTimeDemo&templateURL=https://ivs-demos-cf-stacks-ap-northeast-1.s3.ap-northeast-1.amazonaws.com/IVSRealTimeDemo/83061383d990a3e04c3169833624a976bc944c6ee8fb78b0fd2476b0190560d5.json) |
   | ap-northeast-2 (Seoul) | [![Launch Stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home?region=ap-northeast-2#/stacks/new?stackName=IVSRealTimeDemo&templateURL=https://ivs-demos-cf-stacks-ap-northeast-2.s3.ap-northeast-2.amazonaws.com/IVSRealTimeDemo/892832e3869db19c3a366ab8d699c5bab09dabb0e3807cd5d6a288c4c433db99.json) |

2. Follow the steps on the **Create stack** page. You may optionally specify a different Stack name.
3. After completing all steps, select **Submit** to launch and deploy the stack.

### Use a one-click deploy backend with the client applications

When the deployment successfully completes, save the following values in the **Outputs** tab to generate your `Authentication code`. You will need to enter this code when prompted by the mobile apps:
- `domainName` (the first part of this is your `domainId`)
- `secretUrl` (used to retrieve your `apiKey`)

Open the `secretUrl` in your web browser and click the **Retrieve secret value** button in the **Secret value** section. Once the secrets are visible, copy the `apiKey` value.

To generate your `Authentication code`, join the `domainId` and `apiKey` with a dash: `${domainId}-${apiKey}`.

> For example, if your domainName is `d0abcdefghijk.cloudfront.net` and apiKey is `AbCDEFgHIJKLmnOPQrsTUV`, your authentication code is `d0abcdefghijk-AbCDEFgHIJKLmnOPQrsTUV`.

On your mobile device, simply enter this value when prompted by the app.

## Deploy from the command line

1. If this is your first time deploying the backend stack, run the following command:

   ```
   make app STACK=YOUR_STACK_NAME (default: IVSRealTimeDemo)
   ```

   Otherwise, run the following command to skip the `install` and `bootstrap` processes and go straight into deploying:

   ```
   make deploy STACK=YOUR_STACK_NAME (default: IVSRealTimeDemo)
   ```

   See [Commands](#commands) for a comprehensive list of the `app` and `deploy` options.

2. Press `y` when prompted to acknowledge and proceed with the deployment

### Use the command line deployed backend with the client applications

When the deployment successfully completes, copy the `⭐️ Domain ID` and `🔑 API key` values outputted in your terminal session. On your mobile device, simply enter these values when prompted by the app.

Alternatively, you may use the mobile app to scan the `🔎 Authentication QR code`. Doing so will automatically paste the customer ID and API key into the app and sign you in immediately.

## Tearing down the backend stack

To delete a deployed backend stack, run the following command:

```
make destroy STACK=YOUR_STACK_NAME
```

See [Commands](#commands) for a comprehensive list of the `destroy` option.

_Note: resources created after the deployment will not be deleted. Such resources may include Stages and Chat Rooms._

## Commands

|               | **Description**                                                             | **Options**                                                                   |
| ------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **app**       | Installs NPM dependencies, bootstraps, and deploys the stack                | `AWS_PROFILE`, `AWS_REGION`, `STACK`, `NAG`                                   |
| **install**   | Installs NPM dependencies                                                   | -                                                                             |
| **bootstrap** | Deploys the CDK Toolkit staging stack                                       | `AWS_PROFILE`, `AWS_REGION`, `STACK`, `NAG`                                   |
| **synth**     | Synthesizes the CDK app and produces a cloud assembly in cdk.out            | `AWS_PROFILE`, `AWS_REGION`, `STACK`, `NAG`                                   |
| **deploy**    | Deploys the stack                                                           | `AWS_PROFILE`, `AWS_REGION`, `STACK`, `NAG`                                   |
| **output**    | Retrieves the CloudFormation stack outputs                                  | `STACK`                                                                       |
| **destroy**   | Destroys the stack and cleans up                                            | `AWS_PROFILE`, `AWS_REGION`, `STACK`, `NAG`                                   |
| **clean**     | Deletes the cloud assembly directory (cdk.out)                              | -                                                                             |
| **seed**      | Creates a specified number of randomly generated demo records               | `AWS_PROFILE`, `AWS_REGION`, `STACK`, `COUNT`, `TYPE`                         |
| **publish**   | Publishes stack file assets to an S3 bucket and generate a launch stack URL | `AWS_PROFILE`, `AWS_REGION`, `STACK`, `NAG`, `FILE_ASSETS_BUCKET_NAME_PREFIX` |
| **help**      | Shows a help message with all the available make rules                      | -                                                                             |

### Command options

`AWS_PROFILE` - named AWS CLI profile used for commands that interact with AWS. Defaults to `default`.

`AWS_REGION` - the AWS region used for commands that interact with AWS. Defaults to the region associated with your `default` AWS CLI profile.

`STACK` - the stack name. Defaults to `IVSRealTimeDemo`.

`NAG` - set to `true` to enable application security and compliance checks, Defaults to `false`.

`COUNT` - the number of demo records to seed (maximum is `10`). Defaults to `1`.

`TYPE` - the type of demo records to seed (either `video` or `audio`). Defaults to `video`.

`FILE_ASSETS_BUCKET_NAME_PREFIX` - the name prefix used to create or retrieve the S3 bucket to which file assets are saved from the `publish` command. This prefix is prepended with the AWS region to create the complete bucket name. Required when running the `publish` command.
