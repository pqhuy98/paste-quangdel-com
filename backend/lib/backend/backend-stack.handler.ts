import { createServer, proxy } from 'aws-serverless-express';
import { APIGatewayEvent, Context } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import express from 'express';
import cors from 'cors';
import Joi from 'joi';

// Initialize the Express application
const app = express();
app.use(express.json());
app.use(cors({
  origin: ['paste.quangdel.com'],
}));

// DynamoDB
const dynamoDb = new DynamoDB.DocumentClient();
const tableName = 'pastebin';
let defaultLength = 3;

const CHARACTERS = 'abcdefghijklmnopqrstuvwxyz0123456789';
async function generateId(length: number = defaultLength, retries: number = 3): Promise<string> {
  for (let i = 0; i < retries; i += 1) {
    let id = '';
    for (let j = 0; j < length; j += 1) {
      id += CHARACTERS.charAt(Math.floor(Math.random() * CHARACTERS.length));
    }

    // eslint-disable-next-line no-await-in-loop
    const exists = await dynamoDb.get({
      TableName: tableName,
      Key: { id },
    }).promise();

    if (!exists.Item) {
      defaultLength = length;
      return id;
    }
  }
  return generateId(length + 1);
}

interface PostPasteBody {
  content?: string
  ttl?: number
}
const schemaPostPasteBody = Joi.object<PostPasteBody>({
  content: Joi.string().min(1).max(999999).required(),
  ttl: Joi.number().min(Math.floor(Date.now() / 1000)).optional(),
});

const DEFAULT_TTL_SEC = 5 * 60;

app.post('/paste', async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { error, value } = schemaPostPasteBody.validate(req.body);

  if (error) {
    return res.status(400).json({ error });
  }

  const { content, ttl } = value;
  const id = await generateId(3);
  await dynamoDb.put({
    TableName: tableName,
    Item: { id, content, ttl: ttl || Math.floor(Date.now() / 1000 + DEFAULT_TTL_SEC) },
  }).promise();

  return res.json({ id: `${id}` });
});

app.get('/paste/:id', async (req, res) => {
  const { id } = req.params;
  const result = await dynamoDb.get({
    TableName: tableName,
    Key: { id },
  }).promise();

  if (result.Item) {
    res.json(result.Item);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Create a serverless Express instance
const server = createServer(app);
export const handler = (event: APIGatewayEvent, context: Context) => {
  proxy(server, event, context);
};
