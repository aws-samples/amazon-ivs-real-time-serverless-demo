import {
  aws_apigateway as apigw,
  aws_lambda_nodejs as lambda
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { LambdaIntegrationOptions } from 'aws-cdk-lib/aws-apigateway/lib/integrations';

import { getDefaultLambdaProps } from '../utils';

type FunctionProps = lambda.NodejsFunctionProps & {
  entryFunctionName: string;
};

interface IntegratedProxyLambdaProps {
  api: apigw.RestApi;
  handler: FunctionProps;
  method: string;
  resourcePaths?: string[];
}

export default class IntegratedProxyLambda extends Construct {
  public readonly lambdaFunction: lambda.NodejsFunction;

  constructor(scope: Construct, id: string, props: IntegratedProxyLambdaProps) {
    super(scope, id);

    const {
      api,
      method,
      resourcePaths,
      handler: { entryFunctionName, ...handlerProps }
    } = props;

    const lambdaIntegrationOptions: LambdaIntegrationOptions = {
      proxy: true,
      allowTestInvoke: false
    };

    this.lambdaFunction = new lambda.NodejsFunction(
      this,
      'IntegratedProxyLambda',
      {
        ...getDefaultLambdaProps(entryFunctionName),
        ...handlerProps
      }
    );
    const lambdaIntegration = new apigw.LambdaIntegration(
      this.lambdaFunction,
      lambdaIntegrationOptions
    );

    const resource =
      resourcePaths?.reduce<apigw.IResource>(
        (res, path) => res.addResource(path),
        api.root
      ) || api.root;
    resource.addMethod(method, lambdaIntegration, { apiKeyRequired: true });
  }
}
