import type { VoiceEvents } from './events';
import type { VoiceId } from '../shared-types';

export interface VoiceTool {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface VoiceClientConfig {
  token: string;
  voice: VoiceId;
  systemPrompt?: string;
  tools?: VoiceTool[];
  wsUrl?: string;
}

type EventMap = {
  [K in keyof VoiceEvents]: Set<VoiceEvents[K]>;
};

export class VoiceClient {
  private ws: WebSocket | null = null;
  private config: VoiceClientConfig;
  private listeners: Partial<EventMap> = {};

  constructor(config: VoiceClientConfig) {
    this.config = config;
  }

  on<K extends keyof VoiceEvents>(event: K, handler: VoiceEvents[K]): void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set() as EventMap[K];
    }
    (this.listeners[event] as Set<VoiceEvents[K]>).add(handler);
  }

  off<K extends keyof VoiceEvents>(event: K, handler: VoiceEvents[K]): void {
    (this.listeners[event] as Set<VoiceEvents[K]> | undefined)?.delete(handler);
  }

  private emit<K extends keyof VoiceEvents>(event: K, ...args: Parameters<VoiceEvents[K]>): void {
    const handlers = this.listeners[event] as Set<VoiceEvents[K]> | undefined;
    if (!handlers) return;
    for (const handler of handlers) {
      (handler as (...a: Parameters<VoiceEvents[K]>) => void)(...args);
    }
  }

  private connectResolve: (() => void) | null = null;

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url =
        this.config.wsUrl ?? 'ws://localhost:3001/api/voice/realtime';

      this.connectResolve = resolve;
      this.ws = new WebSocket(url);
      this.ws.binaryType = 'arraybuffer';

      const onErrorOnce = (e: Event) => {
        this.ws?.removeEventListener('error', onErrorOnce);
        this.connectResolve = null;
        reject(new Error(`WebSocket connection failed: ${(e as ErrorEvent).message ?? 'unknown'}`));
      };

      this.ws.addEventListener('error', onErrorOnce);
      this.ws.addEventListener('message', this.handleMessage);
      this.ws.addEventListener('close', this.handleClose);
    });
  }

  private sendSessionUpdate(): void {
    const tools = (this.config.tools ?? []).map((t) => ({
      type: t.type,
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    this.send('session.update', {
      session: {
        voice: this.config.voice,
        instructions: this.config.systemPrompt ?? '',
        turn_detection: null,
        tools,
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: 24000 },
            transcription: { model: 'grok-transcribe' },
          },
          output: {
            format: { type: 'audio/pcm', rate: 24000 },
          },
        },
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: { model: 'grok-transcribe' },
      },
    });
  }

  private handleMessage = (event: MessageEvent): void => {
    let msg: { type: string; [key: string]: unknown };
    try {
      msg = JSON.parse(typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data));
    } catch {
      return;
    }

    if (msg.type === 'connected') {
      this.sendSessionUpdate();
      return;
    }

    switch (msg.type) {
      case 'session.created':
      case 'session.updated':
        if (this.connectResolve) {
          this.connectResolve();
          this.connectResolve = null;
        }
        this.emit('connected');
        break;

      case 'response.output_audio.delta': {
        const b64 = msg.delta as string;
        const binary = atob(b64);
        const buf = new ArrayBuffer(binary.length);
        const view = new Uint8Array(buf);
        for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
        this.emit('audioResponse', buf);
        this.emit('speaking', true);
        break;
      }

      case 'response.output_audio.done':
        this.emit('speaking', false);
        break;

      case 'input_audio_buffer.speech_started':
        this.emit('userSpeaking', true);
        break;

      case 'input_audio_buffer.speech_stopped':
        this.emit('userSpeaking', false);
        break;

      case 'conversation.item.input_audio_transcription.updated':
      case 'conversation.item.input_audio_transcription.delta': {
        const transcript =
          (msg.transcript as string) ??
          (msg.delta as string) ??
          (msg.text as string) ??
          '';
        this.emit('userTranscriptUpdate', transcript, false);
        break;
      }

      case 'conversation.item.input_audio_transcription.completed': {
        const transcript =
          (msg.transcript as string) ??
          (msg.text as string) ??
          '';
        const status = msg.status as string | undefined;
        this.emit('userTranscriptUpdate', transcript, status !== 'in_progress');
        break;
      }

      case 'response.audio_transcript.delta':
      case 'response.output_audio_transcript.delta':
        this.emit('assistantTranscriptUpdate', msg.delta as string, false);
        break;

      case 'response.audio_transcript.done':
      case 'response.output_audio_transcript.done':
        if (typeof msg.transcript === 'string') {
          this.emit('assistantTranscriptUpdate', msg.transcript as string, true);
        }
        break;

      case 'response.function_call_arguments.done': {
        const name = msg.name as string;
        const callId = (msg.call_id as string) ?? '';
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(msg.arguments as string);
        } catch { /* empty */ }
        this.emit('functionCall', callId, name, args);
        break;
      }

      case 'error': {
        const errMsg = (msg.error as { message?: string })?.message
          || (msg.message as string)
          || 'Unknown voice error';
        this.emit('error', new Error(errMsg));
        break;
      }
    }
  };

  private handleClose = (event: CloseEvent): void => {
    this.emit('disconnected', event.reason || `Connection closed (code ${event.code})`);
    this.ws = null;
  };

  sendAudio(pcmData: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const bytes = new Uint8Array(pcmData);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = btoa(binary);
    this.send('input_audio_buffer.append', { audio: b64 });
  }

  clearAudioBuffer(): void {
    this.send('input_audio_buffer.clear', {});
  }

  commitAudioBuffer(): void {
    this.send('input_audio_buffer.commit', {});
  }

  createResponse(): void {
    this.send('response.create', {});
  }

  interrupt(): void {
    this.send('response.cancel', {});
  }

  submitFunctionResult(callId: string, output: string): void {
    if (!callId) return;
    this.send('conversation.item.create', {
      item: {
        type: 'function_call_output',
        call_id: callId,
        output,
      },
    });
    this.send('response.create', {});
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.removeEventListener('message', this.handleMessage);
      this.ws.removeEventListener('close', this.handleClose);
      this.ws.close();
      this.ws = null;
    }
    this.emit('disconnected', 'Client disconnected');
  }

  private send(type: string, payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type, ...payload }));
  }
}
