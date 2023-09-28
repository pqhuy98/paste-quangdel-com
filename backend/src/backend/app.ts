import { DynamoDB, S3 } from 'aws-sdk';
import express, { Express } from 'express';
import cors from 'cors';
import Joi from 'joi';
import multer from 'multer';

// Initialize the Express application
export const app = express();
app.use(express.json());
app.use(cors({
  origin: ['https://paste.quangdel.com', 'http://localhost:3000'],
}));

// DynamoDB
const dynamoDb = new DynamoDB.DocumentClient();
const tableName = 'pastebin';
let defaultLength = 3;

// Initialize S3 client
const s3 = new S3();
const uploadS3BucketName = 'paste.quangdel.com-uploads';

// Configure multer storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // limit to 100MB
  },
});

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

app.post('/paste', upload.array('files', 10), async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { error, value } = schemaPostPasteBody.validate(req.body);

  if (error) {
    return res.status(400).json({ error });
  }

  const { content, ttl } = value;
  const id = await generateId(3);

  // Handle multiple file uploads
  const uploadedFiles: {url:string, fileName: string}[] = [];
  if (req.files) {
    for (const file of req.files as Express.Multer.File[]) {
      const params = {
        Bucket: uploadS3BucketName,
        Key: `${id}_${file.originalname}`,
        Body: file.buffer,
        ContentType: file.mimetype,
      };

      const s3Data = await s3.upload(params).promise();
      uploadedFiles.push({
        url: s3Data.Location,
        fileName: file.originalname,
      });
    }
  }

  await dynamoDb.put({
    TableName: tableName,
    Item: {
      id,
      content,
      ttl: ttl || Math.floor(Date.now() / 1000 + DEFAULT_TTL_SEC),
      uploadedFiles,
    },
  }).promise();

  console.log('Create paste', { id, content, ttl });

  return res.json({ id: `${id}` });
});

app.get('/paste/:id', async (req, res) => {
  const { id } = req.params;
  const result = await dynamoDb.get({
    TableName: tableName,
    Key: { id },
  }).promise();

  console.log('Read paste', { id, resultItem: result.Item });

  if (result.Item) {
    res.json(result.Item);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});
