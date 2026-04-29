import * as Mp4Muxer from "mp4-muxer";

// Defining types locally for the worker context
interface WorkerData {
  songs: { title: string; artist: string; album: string; coverArt: string }[];
  width: number;
  height: number;
  fps: number;
  secondsPerSong: number;
  canvas: OffscreenCanvas;
}

const ctx: Worker = self as any;

ctx.onmessage = async (e: MessageEvent<WorkerData>) => {
  const { songs, width, height, fps, secondsPerSong, canvas } = e.data;
  const offscreenCtx = canvas.getContext("2d")!;

  const framesPerSlide = fps * secondsPerSong;

  // 1. Setup Muxer
  const muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: { 
      codec: "avc", 
      width, 
      height 
    },
    fastStart: "in-memory",
  });

  // 2. Setup Encoder
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error("Encoder Error:", e),
  });

  videoEncoder.configure({
    codec: "avc1.640028", // High Profile, Level 4.1 for 1080p
    width,
    height,
    bitrate: 6_000_000, // Slightly higher for 1080p quality
  });

  // 3. Main Processing Loop
  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    
    // Send progress to main thread (0.0 to 1.0)
    ctx.postMessage({ type: 'progress', p: (i / songs.length) });

    try {
      // Fetch and decode the image
      const img = await fetchAndDecode(song.coverArt);
      
      // Render every frame for this song's slide
      for (let f = 0; f < framesPerSlide; f++) {
        const frameNumber = (i * framesPerSlide) + f;
        
        drawStylishSlide(offscreenCtx, img, song, width, height, i, songs.length);

        const timestamp = (frameNumber * 1e6) / fps;
        const frame = new VideoFrame(canvas, { timestamp });
        
        videoEncoder.encode(frame);
        frame.close();
      }
      
      img.close(); // Clean up image memory
    } catch (err) {
      console.error(`Worker failed to process song index ${i}:`, err);
    }
  }

  // 4. Finalize
  await videoEncoder.flush();
  muxer.finalize();
  
  // Transfer the buffer back to main thread (zero-copy)
  const buffer = muxer.target.buffer as ArrayBuffer;
  ctx.postMessage({ type: 'done', buffer }, [buffer]);
};

/**
 * Handles fetching images with high-res replacement and fallback logic
 */
async function fetchAndDecode(url: string | undefined | null): Promise<ImageBitmap> {
  if (!url) {
    return await createPlaceholderBitmap("Missing Cover Art");
  }

  try {
    // Attempt to get the original high-res version from Cover Art Archive
    const highResUrl = url.replace(/-(250|500|1200)(\.[a-z]+)?$/i, "$2");
    
    const response = await fetch(highResUrl, { mode: 'cors', redirect: 'follow' });
    
    if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
    
    const blob = await response.blob();
    return await createImageBitmap(blob);
  } catch (err) {
    console.warn(`Fetch failed for ${url}, using fallback`, err);
    return await createPlaceholderBitmap("Load Error");
  }
}

/**
 * Creates a generic fallback ImageBitmap if an image fails to load
 */
async function createPlaceholderBitmap(text: string): Promise<ImageBitmap> {
  const canvas = new OffscreenCanvas(1080, 1080);
  const tempCtx = canvas.getContext("2d")!;
  tempCtx.fillStyle = "#1a1a1a";
  tempCtx.fillRect(0, 0, 1080, 1080);
  tempCtx.fillStyle = "#ffffff";
  tempCtx.font = "bold 50px sans-serif";
  tempCtx.textAlign = "center";
  tempCtx.textBaseline = "middle";
  tempCtx.fillText(text, 540, 540);
  return canvas.transferToImageBitmap();
}

/**
 * Draws the stylish slide with blurred background and rank number
 */
function drawStylishSlide(
  ctx: OffscreenCanvasRenderingContext2D, 
  img: ImageBitmap, 
  song: any, 
  width: number, 
  height: number,
  index: number,
  totalSongs: number
): void {
  // 1. Blurred Background
  ctx.save();
  ctx.filter = 'blur(50px) brightness(0.35)'; // Darker and blurrier for better text contrast
  const scale = Math.max(width / img.width, height / img.height);
  const bgW = img.width * scale;
  const bgH = img.height * scale;
  ctx.drawImage(img, (width - bgW) / 2, (height - bgH) / 2, bgW, bgH);
  ctx.restore();

  // 2. Main Cover Art with Shadow
  const padding = 120;
  const cardHeight = height - (padding * 2);
  const cardWidth = (img.width / img.height) * cardHeight;
  const cardX = padding;
  const cardY = padding;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 40;
  ctx.drawImage(img, cardX, cardY, cardWidth, cardHeight);
  ctx.restore();

  // 3. Countdown Rank (#X) - Top Right
  const rank = totalSongs - index; 
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.15)"; // Ghosted look
  ctx.font = "bold 240px sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText(`#${rank}`, width - 60, 20);
  ctx.restore();

  // 4. Track Metadata
  const textX = cardX + cardWidth + 80;
  const centerY = height / 2;
  
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  // Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 72px sans-serif";
  ctx.fillText(song.title.toUpperCase(), textX, centerY - 50);

  // Artist
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.font = "300 44px sans-serif";
  ctx.fillText(song.artist, textX, centerY + 40);

  // Album
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.font = "italic 28px sans-serif";
  ctx.fillText(song.album, textX, centerY + 110);
}