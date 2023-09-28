import { createServer, proxy } from 'aws-serverless-express';
import { APIGatewayEvent, Context } from 'aws-lambda';
import { app } from '../../src/backend/app';

// Create a serverless Express instance
const server = createServer(app);
export const handler = (event: APIGatewayEvent, context: Context) => {
  proxy(server, event, context);
};
