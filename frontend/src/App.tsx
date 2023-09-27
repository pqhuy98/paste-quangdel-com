import React, { useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useParams
} from 'react-router-dom';
import axios from 'axios';
import "./App.css"

const BACKEND_URL = "https://api.paste.quangdel.com"

const CreatePaste: React.FC = () => {
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false)

  const createPaste = async () => {
    if (content.length <= 0) {
      setError("Your paste must not be empty!")
      return
    }

    try {
      setCreating(true)
      const { data } = await axios.post(`${BACKEND_URL}/paste`, { content });
      setUrl("/" + data.id);
      setError("")
      setCreating(false)
    } catch (err: any) {
      console.error('Error creating paste:', error);
      setError(err.response?.status + " " + JSON.stringify(err.response?.data))
      setCreating(false)
    }
  };

  return (
    <div className="container">
      <div>
        <textarea rows={4} cols={50}
          placeholder="Enter your paste content"
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      <div>
        <button disabled={creating} onClick={createPaste}> {creating ? "Creating..." : "Create"}</button>
      </div>
      {url && <p>Created! <Link to={url}>{url}</Link></p>}
      {error.length > 0 && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
};

const ReadPaste: React.FC = () => {
  const [paste, setPaste] = useState<any>(null);
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
      <h1>Paste "{id}":</h1>
      {paste && <pre>{paste.content}</pre>}
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
        <h1>
          <Link to="/">Create Paste</Link>
        </h1>
        <Routes>
          <Route path="/:id" Component={ReadPaste} />
          <Route path="/" Component={CreatePaste} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
