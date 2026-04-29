import { Song, state } from "./main";

export async function exportVideo(): Promise<void> {
  const width = 1920;
  const height = 1080;
  const canvas = new OffscreenCanvas(width, height);

  // 1. CLEAN THE DATA
  // Vue Proxies cannot be sent to Workers. This turns them into a plain array.
  const cleanSongs = JSON.parse(JSON.stringify(state.songList));

  const worker = new Worker(
    new URL('./videoWorker.ts', import.meta.url), 
    { type: 'module' }
  );

  // 2. SEND TO WORKER
  worker.postMessage({
    songs: cleanSongs,
    width,
    height,
    fps: 30,
    secondsPerSong: 5,
    canvas: canvas // This is the OffscreenCanvas object
  }, [canvas]); // Transfer the canvas ownership

  worker.onmessage = (e) => {
    if (e.data.type === 'done') {
      const blob = new Blob([e.data.buffer], { type: "video/mp4" });
      downloadBlob(blob, "playlist.mp4");
      worker.terminate();
    }
  };
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}



async function getAudioSampleUrl(song: Song): Promise<string | null> {
  const query = encodeURIComponent(`${song.artist} ${song.title}`);
  try {
    const response = await fetch(`https://itunes.apple.com/search?term=${query}&entity=song&limit=1`);
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      return data.results[0].previewUrl; // 30s MP3 link
    }
  } catch (e) {
    console.error("iTunes fetch failed", e);
  }
  return null;
}



import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export async function exportVideoWithAudio(): Promise<void> {
  const ffmpeg = new FFmpeg();
  
  // 1. Load FFmpeg
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  // 2. Get Video from your Worker (Existing Logic)
  // Assume 'videoBuffer' is the ArrayBuffer returned by your worker
  const videoBuffer = await runVideoWorker(); 
  await ffmpeg.writeFile('input.mp4', new Uint8Array(videoBuffer));

  // 3. Download and Prepare Audio
  const songs = state.songList;
  const audioParts: string[] = [];

  for (let i = 0; i < songs.length; i++) {
    const audioUrl = await getAudioSampleUrl(songs[i]);
    if (audioUrl) {
      const name = `audio${i}.mp3`;
      await ffmpeg.writeFile(name, await fetchFile(audioUrl));
      
      // Trim audio to 5s to match slide duration
      await ffmpeg.exec(['-i', name, '-t', '5', '-acodec', 'libmp3lame', `trimmed${i}.mp3`]);
      audioParts.push(`file trimmed${i}.mp3`);
    }
  }

  // 4. Concatenate Audio Parts
  await ffmpeg.writeFile('concat.txt', audioParts.join('\n'));
  await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', 'full_audio.mp3']);

  // 5. Final Merge: Video + Audio
  // -shortest ensures the video ends when the audio (or video) runs out
  await ffmpeg.exec([
    '-i', 'input.mp4', 
    '-i', 'full_audio.mp3', 
    '-c:v', 'copy', 
    '-c:a', 'aac', 
    '-map', '0:v:0', 
    '-map', '1:a:0', 
    '-shortest', 
    'final_output.mp4'
  ]);

  // 6. Download
  const data = await ffmpeg.readFile('final_output.mp4');
  downloadBlob(new Blob([(data as any).buffer], { type: 'video/mp4' }), 'playlist_with_audio.mp4');
}


/**
 * Triggers the Web Worker and returns a promise that resolves
 * with the final MP4 ArrayBuffer.
 */
async function runVideoWorker(): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    // 1. Create the worker instance
    // Note: The URL path depends on your build tool (Vite, Webpack, etc.)
    const worker = new Worker(
      new URL('./videoWorker.ts', import.meta.url), 
      { type: 'module' }
    );

    // 2. Create the OffscreenCanvas
    const width = 1920;
    const height = 1080;
    const canvas = new OffscreenCanvas(width, height);

    // 3. Clean the data (Strip Vue/Framework Proxies)
    const cleanSongs = JSON.parse(JSON.stringify(state.songList));

    // 4. Send to worker
    // The second argument [canvas] is the "Transfer List"
    worker.postMessage({
      songs: cleanSongs,
      width,
      height,
      fps: 30,
      secondsPerSong: 5,
      canvas: canvas
    }, [canvas]);

    // 5. Handle messages from worker
    worker.onmessage = (e) => {
      const { type, p, buffer } = e.data;

      if (type === 'progress') {
        // You can link this to a reactive progress bar in your UI
        console.log(`Video Render Progress: ${Math.round(p * 100)}%`);
      }

      if (type === 'done') {
        console.log("Video frames rendered and muxed.");
        worker.terminate(); // Clean up the worker thread
        resolve(buffer);    // Return the ArrayBuffer to the caller
      }
    };

    worker.onerror = (err) => {
      console.error("Worker crashed:", err);
      worker.terminate();
      reject(err);
    };
  });
}