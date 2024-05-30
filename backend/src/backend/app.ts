import { DynamoDB, S3 } from 'aws-sdk';
import express from 'express';
import cors from 'cors';
import Joi from 'joi';
import { FRONTEND_DOMAIN_NAME, DYNAMODB_TABLE_NAME, FILE_UPLOAD_S3_BUCKET_NAME } from '../common';

// Initialize the Express application
export const app = express();
app.use(express.json());
app.use(cors({
  origin: [`https://${FRONTEND_DOMAIN_NAME}`, 'http://localhost:3000'],
}));

// DynamoDB
const dynamoDb = new DynamoDB.DocumentClient();
const tableName = DYNAMODB_TABLE_NAME;
let defaultLength = 3;

// Initialize S3 client
const s3 = new S3();

const CHARACTERS = 'abcdefghjkmnpqrstuvwxyz123456789';
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
  files?: {
    clientId: string
    originalName: string
  }[]
  ttlSecond?: number
}
const schemaPostPasteBody = Joi.object<PostPasteBody>({
  content: Joi.string().min(0).max(999999).required(),
  files: Joi.array().items({
    clientId: Joi.string().required(),
    originalName: Joi.string().required(),
  }).optional(),
  ttlSecond: Joi.number().min(0).optional(),
});

app.post('/paste', async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { error, value } = schemaPostPasteBody.validate(req.body);

  if (error) {
    return res.status(400).json({ error });
  }

  const { content, ttlSecond, files } = value;
  const id = await generateId(3);

  // Handle multiple file uploads
  const uploadedFiles: {url:string, fileName: string}[] = [];

  const fileUploadPresigned: {
      clientId: string
      originalName: string
      data: S3.PresignedPost
  }[] = [];

  for (const file of (files || [])) {
    const s3Key = `${id}_${file.clientId}_${file.originalName}`;

    const presignedData = s3.createPresignedPost({
      Bucket: FILE_UPLOAD_S3_BUCKET_NAME,
      Fields: {
        key: s3Key,
      },
      Conditions: [
        ['content-length-range', 0, 500 * 1024 * 1024], // size restrictions: 500MB
      ],
      Expires: 60 * 2, // 2 minutes
    });

    fileUploadPresigned.push({
      clientId: file.clientId,
      originalName: file.originalName,
      data: presignedData,
    });

    uploadedFiles.push({
      url: `${presignedData.url}/${presignedData.fields.key}`,
      fileName: file.originalName,
    });
  }

  await dynamoDb.put({
    TableName: tableName,
    Item: {
      id,
      content,
      ttl: ttlSecond !== undefined ? Math.floor(Date.now() / 1000 + ttlSecond) : undefined,
      uploadedFiles,
    },
  }).promise();

  console.log('Created paste', { id, ttlSecond });
  return res.json({
    id: `${id}`,
    fileUploadPresigned,
  });
});

app.get('/paste/:id', async (req, res) => {
  const { id } = req.params;
  const result = await dynamoDb.get({
    TableName: tableName,
    Key: { id },
  }).promise();

  console.log('Read paste', { id });

  if (result.Item && !(result.Item["ttl"] != null && result.Item["ttl"] <= Math.floor(Date.now() / 1000))) {
    res.json(result.Item);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});
