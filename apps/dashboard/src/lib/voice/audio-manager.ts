const TARGET_SAMPLE_RATE = 24000;

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private analyserData: Uint8Array | null = null;
  private audioDataCallback: ((pcm: ArrayBuffer) => void) | null = null;

  private playbackCtx: AudioContext | null = null;
  private playbackQueue: AudioBuffer[] = [];
  private isPlaying = false;
  private nextPlayTime = 0;

  async startMic(): Promise<void> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('MIC_NOT_SUPPORTED');
    }

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: TARGET_SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        throw new Error('MIC_PERMISSION_DENIED');
      }
      if (err.name === 'NotFoundError') {
        throw new Error('MIC_NOT_FOUND');
      }
      throw err;
    }

    this.audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });

    const workletUrl = this.createWorkletBlobUrl();
    await this.audioContext.audioWorklet.addModule(workletUrl);
    URL.revokeObjectURL(workletUrl);

    this.sourceNode = this.audioContext.createMediaStreamSource(this.micStream);
    this.workletNode = new AudioWorkletNode(this.audioContext, 'mic-capture');

    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.7;
    this.analyserData = new Uint8Array(this.analyserNode.frequencyBinCount);

    this.workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      const pcm = event.data;
      if (this.audioContext && this.audioContext.sampleRate !== TARGET_SAMPLE_RATE) {
        const resampled = this.resample(pcm, this.audioContext.sampleRate, TARGET_SAMPLE_RATE);
        this.audioDataCallback?.(resampled);
      } else {
        this.audioDataCallback?.(pcm);
      }
    };

    this.sourceNode.connect(this.analyserNode);
    this.analyserNode.connect(this.workletNode);
  }

  stopMic(): void {
    this.workletNode?.disconnect();
    this.analyserNode?.disconnect();
    this.sourceNode?.disconnect();
    this.micStream?.getTracks().forEach((t) => t.stop());
    void this.audioContext?.close();
    this.workletNode = null;
    this.analyserNode = null;
    this.analyserData = null;
    this.sourceNode = null;
    this.micStream = null;
    this.audioContext = null;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  getAudioLevel(): number {
    if (!this.analyserNode || !this.analyserData) return 0;
    this.analyserNode.getByteTimeDomainData(
      this.analyserData as Uint8Array<ArrayBuffer>,
    );
    let sum = 0;
    for (let i = 0; i < this.analyserData.length; i++) {
      const v = (this.analyserData[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / this.analyserData.length);
  }

  playAudio(pcmData: ArrayBuffer): void {
    if (!this.playbackCtx) {
      this.playbackCtx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
    }

    const int16 = new Int16Array(pcmData);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
    }

    const buffer = this.playbackCtx.createBuffer(1, float32.length, TARGET_SAMPLE_RATE);
    buffer.getChannelData(0).set(float32);
    this.playbackQueue.push(buffer);

    if (!this.isPlaying) this.drainQueue();
  }

  stopPlayback(): void {
    this.playbackQueue = [];
    this.isPlaying = false;
    this.nextPlayTime = 0;
  }

  onAudioData(callback: (pcm: ArrayBuffer) => void): void {
    this.audioDataCallback = callback;
  }

  private drainQueue(): void {
    if (!this.playbackCtx || this.playbackQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const buffer = this.playbackQueue.shift()!;
    const source = this.playbackCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.playbackCtx.destination);

    const now = this.playbackCtx.currentTime;
    const startTime = Math.max(now, this.nextPlayTime);
    source.start(startTime);
    this.nextPlayTime = startTime + buffer.duration;

    source.onended = () => this.drainQueue();
  }

  private resample(pcmBuffer: ArrayBuffer, fromRate: number, toRate: number): ArrayBuffer {
    const input = new Int16Array(pcmBuffer);
    const ratio = fromRate / toRate;
    const outputLength = Math.round(input.length / ratio);
    const output = new Int16Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio;
      const idx = Math.floor(srcIndex);
      const frac = srcIndex - idx;
      const a = input[idx] ?? 0;
      const b = input[Math.min(idx + 1, input.length - 1)] ?? 0;
      output[i] = Math.round(a + frac * (b - a));
    }

    return output.buffer;
  }

  private createWorkletBlobUrl(): string {
    const code = `
class MicCaptureProcessor extends AudioWorkletProcessor {
  process(inputs, _outputs, _parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const samples = input[0];
    const pcm = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    this.port.postMessage(pcm.buffer, [pcm.buffer]);
    return true;
  }
}
registerProcessor('mic-capture', MicCaptureProcessor);
`;
    const blob = new Blob([code], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
  }
}
