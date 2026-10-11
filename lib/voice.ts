export interface SpeechResult {
  isFinal: boolean;
  0: { transcript: string };
  length: number;
}
export interface SpeechEvent {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechResult };
}
export interface SpeechRecognizer {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type SpeechConstructor = new () => SpeechRecognizer;
export function speechConstructor(): SpeechConstructor | undefined {
  return (
    (
      window as unknown as {
        SpeechRecognition?: SpeechConstructor;
        webkitSpeechRecognition?: SpeechConstructor;
      }
    ).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: SpeechConstructor })
      .webkitSpeechRecognition
  );
}
