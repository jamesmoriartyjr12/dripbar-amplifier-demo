import { encodeWav, mergeChunks, resample } from "./wav";

export interface Recording {
  stop(): Promise<Blob>;
  cancel(): void;
  /** 0–1 input level for the orb and waveform. */
  level(): number;
}

export class MicrophoneError extends Error {
  constructor(public readonly status: string, message: string) {
    super(message);
    this.name = "MicrophoneError";
  }
}

/**
 * Captures mono PCM through Web Audio so the result can be encoded as WAV without a codec.
 * The stream and audio context are released on stop or cancel; samples live only in memory.
 */
export async function startRecording(): Promise<Recording> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new MicrophoneError("microphone unavailable", "This browser can't record audio.");
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      throw new MicrophoneError("microphone permission denied", "Microphone access was not allowed.");
    }
    throw new MicrophoneError("microphone unavailable", "No microphone could be opened.");
  }

  let context: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode;
  let analyser: AnalyserNode;
  let processor: ScriptProcessorNode;
  let chunks: Float32Array[] = [];
  try {
    context = new AudioContext();
    source = context.createMediaStreamSource(stream);
    analyser = context.createAnalyser();
    analyser.fftSize = 512;
    processor = context.createScriptProcessor(4096, 1, 1);
    const silent = context.createGain();
    silent.gain.value = 0;
    processor.onaudioprocess = (event) => {
      chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
    };
    source.connect(analyser);
    source.connect(processor);
    processor.connect(silent);
    silent.connect(context.destination);
  } catch {
    stream.getTracks().forEach((track) => track.stop());
    void context?.close().catch(() => undefined);
    throw new MicrophoneError("audio setup failed", "This browser couldn't process the recording.");
  }
  const audioContext = context;
  const levelBuffer = new Uint8Array(analyser.fftSize);

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    processor.onaudioprocess = null;
    source.disconnect();
    processor.disconnect();
    stream.getTracks().forEach((track) => track.stop());
    void audioContext.close();
  };

  return {
    level() {
      if (released) return 0;
      analyser.getByteTimeDomainData(levelBuffer);
      let peak = 0;
      for (const value of levelBuffer) peak = Math.max(peak, Math.abs(value - 128));
      return Math.min(1, peak / 64);
    },
    async stop() {
      const sampleRate = audioContext.sampleRate;
      release();
      const pcm = resample(mergeChunks(chunks), sampleRate);
      chunks = [];
      return new Blob([encodeWav(pcm)], { type: "audio/wav" });
    },
    cancel() {
      release();
      chunks = [];
    },
  };
}
