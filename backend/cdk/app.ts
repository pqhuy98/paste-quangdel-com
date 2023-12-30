#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BackendStack } from './backend/backend-stack';
import { FrontendStack } from './frontend/frontend-stack';
import { APP_NAME } from '../src/common';

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new cdk.App();
const _backendStack = new BackendStack(app, `${APP_NAME}Backend`, { env });
const _frontendStack = new FrontendStack(app, `${APP_NAME}Frontend`, { env });
