#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BackendStack } from './backend/backend-stack';
import { FrontendStack } from './frontend/frontend-stack';

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new cdk.App();
const _backendStack = new BackendStack(app, 'PasteBackend', { env });
const _frontendStack = new FrontendStack(app, 'PasteFrontend', { env });
