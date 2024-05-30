import React, { useCallback, useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useParams,
  useNavigate
} from 'react-router-dom';
import axios from 'axios';
import "./App.css"

const BACKEND_URL = "https://api.paste.quangdel.com"
// const BACKEND_URL = "http://localhost:8080"
const MAX_FILE_SIZE_MB = 500;  // Convert to bytes
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;  // Convert to bytes

const CreatePaste: React.FC = () => {
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [ttlSecondStr, setTtlSecondStr] = useState("300");
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate();

  const createPaste = async () => {
    if (content.length <= 0 && (files?.length ?? 0) <= 0) {
      setError("Your paste must not be empty!")
      return
    }

    const formData = new FormData();
    formData.append("content", content);
    const ttlSecond = ttlSecondStr === 'undefined' ? undefined : parseInt(ttlSecondStr);

    const fileArray: File[] = []
    if (files) {
      for (let i = 0; i < files.length; i++) {
        if (files[i].size > MAX_FILE_SIZE_BYTES) {
          setError(`File "${files[i].name}" exceeds ${MAX_FILE_SIZE_MB} MB!`)
          return;
        }
      }
      for (let i = 0; i < files.length; i++) {
        fileArray.push(files[i])
      }
    }

    const filesRequests = fileArray.map((file, i) => ({
      clientId: `${i}`,
      originalName: file.name,
    }))

    try {
      setCreating(true)
      const { data } = await axios.post(`${BACKEND_URL}/paste`, {
        content,
        ttlSecond,
        files: filesRequests
      });
      for (let i = 0; i < data.fileUploadPresigned.length; i++) {
        const presignedData = data.fileUploadPresigned[i].data;
        const formData = new FormData();
        Object.entries(presignedData.fields).forEach(([k, v]) => {
          formData.append(k, v as any);
        });
        formData.append("file", fileArray[i]); // must be the last one

        // upload file[i] to S3 using presigned URL
        await axios.post(presignedData.url, formData);
      }
      navigate("/" + data.id);
    } catch (err: any) {
      console.error('Error creating paste:', error);
      setError(err.response?.status + " " + JSON.stringify(err.response?.data))
      setCreating(false)
    }
  };

  return (
    <div className="container">
      <h1>
        <Link to="/">Create Personal Paste</Link>
      </h1>

      <div>
        <textarea
          placeholder="Enter your paste content"
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      <div>
        <input type="file" multiple onChange={(e) => setFiles(e.target.files)} />
      </div>

      <div>
        <select value={ttlSecondStr} onChange={(e) => setTtlSecondStr(e.target.value)}>
          <option value={60 * 5}>5 minutes</option>
          <option value={60 * 60}>1 hour</option>
          <option value={60 * 60 * 24}>1 day</option>
          <option value={60 * 60 * 24 * 7}>7 days</option>
          <option value={60 * 60 * 24 * 30}>30 days</option>
          <option value={60 * 60 * 24 * 365}>1 year</option>
          <option value="undefined">forever</option>
        </select>
      </div>

      <div>
        <button disabled={creating} onClick={createPaste}> {creating ? "Creating..." : "Create"}</button>
      </div>
      {error.length > 0 && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
};

const ReadPaste: React.FC = () => {
  const [paste, setPaste] = useState<{
    content: string,
    uploadedFiles: { fileName: string, url: string }[]
    ttl?: number
  } | null>(null);
  const { id } = useParams<{ id: string }>();
  const [error, setError] = useState('');
  const [remainingTime, setRemainingTime] = useState('');


  const fetchPaste = async () => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/paste/${id}`);
      setPaste(data);
      setError("")
    } catch (err: any) {
      console.error('Error fetching paste:', error);
      setError(err.response?.status + " " + JSON.stringify(err.response?.data))
    }
  };

  const updateRemainingTime = useCallback(() => {
    if (paste && paste?.ttl === undefined) {
      setRemainingTime("This paste will never expire (forever)");
      return;
    }

    if (paste?.ttl) {
      const now = Date.now() / 1000;
      const diff = paste.ttl - now;
      const date = new Date(paste.ttl * 1000);
      const absoluteTime = date.toLocaleString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        timeZoneName: 'short',
      });

      if (diff > 0) {
        const months = Math.floor(diff / (3600 * 24 * 30));
        const days = Math.floor((diff % (3600 * 24 * 30)) / (3600 * 24));
        const hours = Math.floor((diff % (3600 * 24)) / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = Math.floor(diff % 60);

        let remainingTimeString = `Will expire on ${absoluteTime} (in `;
        if (months > 0) remainingTimeString += `${months} months `;
        if (days > 0) remainingTimeString += `${days} days `;
        if (hours > 0) remainingTimeString += `${hours} hours `;
        if (minutes > 0) remainingTimeString += `${minutes} minutes `;
        if (seconds > 0) remainingTimeString += `${seconds} seconds`;
        remainingTimeString = remainingTimeString.trim() + ")";

        setRemainingTime(remainingTimeString);
      } else {
        setRemainingTime(`Expired at ${absoluteTime}`);
      }
    }
  }, [paste])

  useEffect(() => {
    fetchPaste();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    updateRemainingTime()
  }, [updateRemainingTime]);

  return (
    <div className="container">
      <h1>
        <Link to="/">Create Personal Paste</Link>
      </h1>

      <h3>{window.location.href}</h3>

      {paste && <pre>{paste.content}</pre>}

      {paste?.uploadedFiles?.length
        ? <div>
          File(s): {
            paste.uploadedFiles.map(file => <div>
              <a href={file.url} target="_blank" rel="noreferrer">{file.fileName}</a>
            </div>
            )}
        </div>
        : null}

      {!paste && (
        error.length === 0 ? <p>Loading...</p> : <p style={{ color: "red" }}>{error}</p>
      )}

      <p>{remainingTime}</p>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <div>

        <Routes>
          <Route path="/:id" Component={ReadPaste} />
          <Route path="/" Component={CreatePaste} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
