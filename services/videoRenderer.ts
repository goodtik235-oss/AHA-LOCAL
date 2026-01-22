
import { Caption } from "../types";

/**
 * Renders a video with burnt-in captions and optional dubbed AudioBuffer.
 */
export async function renderVideoWithCaptions(
  videoSrc: string,
  captions: Caption[],
  onProgress: (progress: number) => void,
  signal: AbortSignal,
  dubbedAudioBuffer?: AudioBuffer | null
): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    const video = document.createElement('video');
    video.src = videoSrc;
    video.crossOrigin = "anonymous";
    video.muted = !!dubbedAudioBuffer;

    await video.play();
    video.pause();
    video.currentTime = 0;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject("Could not get canvas context");

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const videoStream = canvas.captureStream(30);
    const audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();
    
    if (dubbedAudioBuffer) {
      const dubSource = audioCtx.createBufferSource();
      dubSource.buffer = dubbedAudioBuffer;
      dubSource.connect(dest);
      dubSource.start(0);
    } else {
      const videoAudioSource = audioCtx.createMediaElementSource(video);
      videoAudioSource.connect(dest);
    }

    const combinedStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...dest.stream.getAudioTracks()
    ]);

    const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9,opus' });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(blob);
    };

    recorder.start();
    video.play();

    const drawFrame = () => {
      if (signal.aborted) {
        recorder.stop();
        video.pause();
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }

      if (video.ended) {
        recorder.stop();
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const currentTime = video.currentTime;
      const activeCaption = captions.find(c => currentTime >= c.start && currentTime <= c.end);
      
      if (activeCaption) {
        const padding = 20;
        const fontSize = Math.floor(canvas.height / 18);
        ctx.font = `bold ${fontSize}px "Plus Jakarta Sans"`;
        ctx.textAlign = 'center';
        
        const metrics = ctx.measureText(activeCaption.text);
        const textWidth = metrics.width;
        
        ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
        ctx.beginPath();
        const rectX = canvas.width / 2 - textWidth / 2 - 30;
        const rectY = canvas.height - fontSize * 2.5;
        const rectW = textWidth + 60;
        const rectH = fontSize + 30;
        const radius = 15;
        ctx.roundRect(rectX, rectY, rectW, rectH, radius);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.fillText(activeCaption.text, canvas.width / 2, canvas.height - fontSize * 1.6);
        ctx.shadowBlur = 0;
      }

      onProgress(video.currentTime / video.duration);
      requestAnimationFrame(drawFrame);
    };

    drawFrame();
  });
}
