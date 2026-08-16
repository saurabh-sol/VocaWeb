export interface VoiceEvents {
  connected: () => void;
  disconnected: (reason: string) => void;
  userTranscriptUpdate: (text: string, isFinal: boolean) => void;
  assistantTranscriptUpdate: (text: string, isFinal: boolean) => void;
  audioResponse: (audioData: ArrayBuffer) => void;
  functionCall: (callId: string, name: string, args: Record<string, unknown>) => void;
  error: (error: Error) => void;
  speaking: (isSpeaking: boolean) => void;
  userSpeaking: (isSpeaking: boolean) => void;
}
