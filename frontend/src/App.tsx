import React, { useEffect, useState } from 'react';
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
const MAX_FILE_SIZE_MB = 100;  // Convert to bytes
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;  // Convert to bytes

const CreatePaste: React.FC = () => {
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate();

  const createPaste = async () => {
    if (content.length <= 0) {
      setError("Your paste must not be empty!")
      return
    }

    const formData = new FormData();
    formData.append("content", content);

    if (files) {
      // Check file size
      for (let i = 0; i < files.length; i++) {
        if (files[i].size > MAX_FILE_SIZE_BYTES) {
          setError(`File "${files[i].name}" exceeds ${MAX_FILE_SIZE_MB} MB!`)
          return;
        }
      }

      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
    }

    try {
      setCreating(true)
      const { data } = await axios.post(`${BACKEND_URL}/paste`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
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
  } | null>(null);
  const { id } = useParams<{ id: string }>();
  const [error, setError] = useState('');

  const fetchPaste = async () => {
    console.log({ id })
    try {
      const { data } = await axios.get(`${BACKEND_URL}/paste/${id}`);
      setPaste(data);
      setError("")
    } catch (err: any) {
      console.error('Error fetching paste:', error);
      setError(err.response?.status + " " + JSON.stringify(err.response?.data))
    }
  };

  useEffect(() => {
    fetchPaste();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
