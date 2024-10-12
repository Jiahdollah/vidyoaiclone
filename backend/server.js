const express = require('express');
const mongoose = require('mongoose');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect('mongodb://localhost/vidyo_clone', { useNewUrlParser: true, useUnifiedTopology: true });

// Create a Video schema
const VideoSchema = new mongoose.Schema({
  youtubeUrl: String,
  originalDuration: Number,
  shortDuration: Number,
  status: String,
  shortVideoUrl: String,
});

const Video = mongoose.model('Video', VideoSchema);

// Initialize OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json());

// API endpoint to process a YouTube video
app.post('/api/process-video', async (req, res) => {
  const { youtubeUrl } = req.body;

  try {
    // Download YouTube video
    const videoInfo = await ytdl.getInfo(youtubeUrl);
    const videoStream = ytdl(youtubeUrl, { quality: 'highest' });
    const outputPath = path.join(__dirname, 'videos', `${videoInfo.videoDetails.videoId}.mp4`);
    
    videoStream.pipe(fs.createWriteStream(outputPath));

    // Create a new Video document
    const video = new Video({
      youtubeUrl,
      originalDuration: parseInt(videoInfo.videoDetails.lengthSeconds),
      status: 'downloading',
    });
    await video.save();

    // Process video after download
    videoStream.on('end', async () => {
      // Update status
      video.status = 'processing';
      await video.save();

      // Extract audio
      const audioPath = path.join(__dirname, 'audio', `${videoInfo.videoDetails.videoId}.mp3`);
      ffmpeg(outputPath)
        .outputOptions('-vn')
        .save(audioPath)
        .on('end', async () => {
          // Transcribe audio
          const transcription = await transcribeAudio(audioPath);

          // Summarize transcription
          const summary = await summarizeTranscription(transcription);

          // Generate short video
          const shortVideoPath = await generateShortVideo(outputPath, summary);

          // Update video document
          video.status = 'completed';
          video.shortVideoUrl = shortVideoPath;
          video.shortDuration = 60; // Assuming 60-second TikTok-style video
          await video.save();
        });
    });

    res.json({ message: 'Video processing started', videoId: video._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Function to transcribe audio using OpenAI's Whisper API
async function transcribeAudio(audioPath) {
  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: "whisper-1",
  });
  return response.text;
}

// Function to summarize transcription using GPT-3
async function summarizeTranscription(transcription) {
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "You are a helpful assistant that summarizes video content." },
      { role: "user", content: `Summarize the following video transcription in 60 seconds of content: ${transcription}` }
    ],
  });
  return response.choices[0].message.content;
}

// Function to generate a short video based on the summary
async function generateShortVideo(inputPath, summary) {
  // This is a simplified version. In a real app, you'd use the summary to select relevant parts of the video.
  const outputPath = inputPath.replace('.mp4', '_short.mp4');
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime('00:00:00')
      .setDuration('60')
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
