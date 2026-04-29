import * as Mp4Muxer from "mp4-muxer";
import { Song, state } from "./main";

async function loadImages(songs: Song[]): Promise<ImageBitmap[]> {
  const promises = songs.map(async (song, index) => {
    if (!song.coverArt) return createPlaceholderBitmap("No Image");

    try {
      // Stripping the -250/500 suffix to get original high-res quality
      const highResUrl = song.coverArt.replace(/-(250|500|1200)(\.[a-z]+)?$/i, "$2");
      const response = await fetch(highResUrl, { mode: 'cors', redirect: 'follow' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      return await createImageBitmap(blob);
    } catch (err) {
      console.error(`Failed to load: ${song.coverArt}`, err);
      return createPlaceholderBitmap("Load Error");
    }
  });

  return Promise.all(promises);
}

async function createPlaceholderBitmap(text: string): Promise<ImageBitmap> {
  const canvas = new OffscreenCanvas(1080, 1080);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 40px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, 540, 540);
  return canvas.transferToImageBitmap();
}

export async function exportVideo(): Promise<void> {
  // 1080p Settings
  const width = 1920; 
  const height = 1080;
  const fps = 30;
  const secondsPerSong = 5; // Longer duration as requested
  const framesPerSlide = fps * secondsPerSong; 
  
  const songs = state.songList;
  const totalFrames = songs.length * framesPerSlide;
  const images = await loadImages(songs);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;

  const muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: { 
        codec: "avc", 
        width, 
        height 
    },
    fastStart: "in-memory",
  });

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error(e),
  });

  // Level 4.1 is required for 1080p @ 30fps
  videoEncoder.configure({
    codec: "avc1.640028", 
    width,
    height,
    bitrate: 5_000_000, // Higher bitrate for 1080p
  });

  for (let frameNumber = 0; frameNumber < totalFrames; frameNumber++) {
    const songIndex = Math.floor(frameNumber / framesPerSlide);
    const currentSong = songs[songIndex];
    const currentImg = images[songIndex];

    drawStylishSlide(ctx, currentImg, currentSong);

    const timestamp = (frameNumber * 1e6) / fps;
    const frame = new VideoFrame(canvas, { timestamp });
    videoEncoder.encode(frame);
    frame.close();

    if (frameNumber % 30 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  await videoEncoder.flush();
  muxer.finalize();
  downloadBlob(new Blob([muxer.target.buffer]), "album_preview.mp4");
}

function drawStylishSlide(
  ctx: OffscreenCanvasRenderingContext2D, 
  img: ImageBitmap, 
  song: Song
): void {
  const { width, height } = ctx.canvas;

  // 1. Draw Blurred Background (Stylish "Vibe" effect)
  ctx.save();
  ctx.filter = 'blur(40px) brightness(0.4)';
  // Scale image to cover entire background
  const scale = Math.max(width / img.width, height / img.height);
  const bgW = img.width * scale;
  const bgH = img.height * scale;
  ctx.drawImage(img, (width - bgW) / 2, (height - bgH) / 2, bgW, bgH);
  ctx.restore();

  // 2. Draw Main Cover Art with Shadow
  const padding = 100;
  const cardHeight = height - (padding * 2);
  const cardWidth = (img.width / img.height) * cardHeight;
  const cardX = padding;
  const cardY = padding;

  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 30;
  ctx.drawImage(img, cardX, cardY, cardWidth, cardHeight);
  ctx.shadowBlur = 0; // Reset shadow

  // 3. Stylish Text Placement
  const textX = cardX + cardWidth + 60;
  const centerY = height / 2;

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  // Title
  ctx.fillStyle = "white";
  ctx.font = "bold 60px Inter, system-ui, sans-serif";
  ctx.fillText(song.title.toUpperCase(), textX, centerY - 40);

  // Artist
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.font = "300 40px Inter, system-ui, sans-serif";
  ctx.fillText(song.artist!, textX, centerY + 40);

  // Album (Subtle)
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.font = "italic 24px Inter, system-ui, sans-serif";
  ctx.fillText(song.album!, textX, centerY + 100);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}