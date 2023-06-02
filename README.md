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

## Deploying the backend stack

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

## Using the deployed backend with the client applications

When the deployment successfully completes, copy the `⭐️ Customer ID` and `🔑 API key` values outputted in your terminal session. On your mobile device, simply enter these values when prompted by the app.

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
