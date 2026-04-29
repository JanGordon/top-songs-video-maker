import * as Mp4Muxer from "mp4-muxer";

ctx.onmessage = async (e) => {
  const { songs, width, height, fps, secondsPerSong } = e.data;
  const canvas = e.data.canvas; // This is the transferred OffscreenCanvas
  const ctx = canvas.getContext("2d")!;

  const framesPerSlide = fps * secondsPerSong;
  const totalFrames = songs.length * framesPerSlide;

  // Setup Muxer
  const muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: { codec: "avc", width, height },
  });

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error("Encoder Error:", e),
  });

  videoEncoder.configure({
    codec: "avc1.640028",
    width, height,
    bitrate: 5_000_000,
  });

  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    
    // Notify main thread of progress
    ctx.postMessage({ type: 'progress', p: (i / songs.length) });

    // 1. Fetch and Decode inside Worker
    const img = await fetchAndDecode(song.coverArt);

    for (let f = 0; f < framesPerSlide; f++) {
      const frameNumber = (i * framesPerSlide) + f;
      
      drawStylishSlide(ctx, img, song, width, height);

      const timestamp = (frameNumber * 1e6) / fps;
      const frame = new VideoFrame(canvas, { timestamp });
      videoEncoder.encode(frame);
      frame.close();
    }
    img.close(); // Clean up memory
  }

  await videoEncoder.flush();
  muxer.finalize();
  
  // Send the final buffer back
  ctx.postMessage({ type: 'done', buffer: muxer.target.buffer }, [muxer.target.buffer]);
};

async function fetchAndDecode(url) {
    // Insert your existing fetch logic + highResUrl logic here
    const res = await fetch(url.replace(/-(250|500|1200)/, ""), { mode: 'cors' });
    const blob = await res.blob();
    return createImageBitmap(blob);
}

function drawStylishSlide(ctx, img, song, width, height) {
    // Insert your stylish drawing logic here
}