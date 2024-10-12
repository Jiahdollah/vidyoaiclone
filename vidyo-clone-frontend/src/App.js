// App.js
import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [message, setMessage] = useState('');
  const [videoId, setVideoId] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/process-video', { youtubeUrl });
      setMessage(response.data.message);
      setVideoId(response.data.videoId);
    } catch (error) {
      setMessage(`Error: ${error.response.data.error}`);
    }
  };

  return (
    <div className="App">
      <h1>Vidyo AI Clone</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
          placeholder="Enter YouTube URL"
          required
        />
        <button type="submit">Process Video</button>
      </form>
      {message && <p>{message}</p>}
      {videoId && <VideoStatus videoId={videoId} />}
    </div>
  );
}

function VideoStatus({ videoId }) {
  const [status, setStatus] = useState('');
  const [shortVideoUrl, setShortVideoUrl] = useState('');

  React.useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await axios.get(`/api/video-status/${videoId}`);
        setStatus(response.data.status);
        if (response.data.status === 'completed') {
          setShortVideoUrl(response.data.shortVideoUrl);
        } else {
          setTimeout(checkStatus, 5000); // Check again after 5 seconds
        }
      } catch (error) {
        console.error('Error checking video status:', error);
      }
    };

    checkStatus();
  }, [videoId]);

  return (
    <div>
      <p>Status: {status}</p>
      {shortVideoUrl && (
        <video width="320" height="240" controls>
          <source src={shortVideoUrl} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      )}
    </div>
  );
}

export default App;