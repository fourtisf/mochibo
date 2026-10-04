"use client";
/**
 * Voice input: the browser's built-in speech recognition (Web Speech API) turns what the user says
 * into the task text. Free, no key. Chrome and Edge send the audio to their own speech service to
 * transcribe it; Safari does it on the device. Firefox has no support, so the mic button hides there.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

const ctor = (): RecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const ERRORS: Record<string, string> = {
  "not-allowed": "Allow the microphone in your browser to talk to your agent.",
  "service-not-allowed": "Allow the microphone in your browser to talk to your agent.",
  "no-speech": "Didn't catch that. Tap the mic and try again.",
  "audio-capture": "No microphone found.",
  network: "Voice input needs an internet connection.",
};

export function useListener(opts: { onText: (text: string) => void; onFinal: (text: string) => void }) {
  const supported = useSyncExternalStore(
    () => () => {},
    () => ctor() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(opts);
  cb.current = opts;

  useEffect(() => () => rec.current?.abort(), []);

  const stopped = useRef(false);
  const stop = useCallback(() => {
    stopped.current = true;
    rec.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = ctor();
    if (!Ctor) return;
    rec.current?.abort();
    const r = new Ctor();
    r.lang = "en-US";
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    let final = "";
    let failed = false;
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) final += res[0].transcript;
        else interim += res[0].transcript;
      }
      cb.current.onText((final + interim).trim());
    };
    r.onerror = (e) => {
      if (e.error === "aborted" || rec.current !== r) return;
      failed = true;
      setError(ERRORS[e.error] ?? "Voice input stopped. Try again.");
    };
    r.onend = () => {
      if (rec.current !== r) return; // an older session that was replaced
      rec.current = null;
      setListening(false);
      const text = final.trim();
      if (text) cb.current.onFinal(text);
      else if (!failed && !stopped.current) setError(ERRORS["no-speech"]);
    };
    rec.current = r;
    stopped.current = false;
    setError(null);
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
      setError("Voice input could not start. Try again.");
    }
  }, []);

  return { supported, listening, error, start, stop };
}
