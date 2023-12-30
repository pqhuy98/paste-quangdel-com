import serverless from 'serverless-http';
import { app } from '../../src/backend/app';

export const handler = serverless(app);
