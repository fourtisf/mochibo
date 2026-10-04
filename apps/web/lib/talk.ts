"use client";
/**
 * Characters that talk. A Talker belongs to one stage: it turns text into sentences, shows the
 * current sentence in a speech bubble above the actor, moves the mouth (actor.talking) and, when
 * voice is on, reads the sentence aloud with the browser's built-in speech (Web Speech API, free,
 * nothing leaves the device). With voice off or unsupported, sentences still show for a reading time.
 */
import { useSyncExternalStore } from "react";
import type { CharacterConfig } from "@orbis/shared";
import type { Actor, Stage } from "@orbis/characters";

export interface VoiceProfile {
  pitch: number;
  rate: number;
}

/** A steady voice per character: bots sound higher and a little faster, humans vary by look. */
export function voiceFor(cfg: Pick<CharacterConfig, "kind" | "hair" | "glow" | "skin">): VoiceProfile {
  const seed = [...`${cfg.hair}${cfg.glow}${cfg.skin}`].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const k = (seed % 1000) / 1000;
  return cfg.kind === "bot" ? { pitch: 1.55 + k * 0.3, rate: 1.06 } : { pitch: 0.95 + k * 0.45, rate: 1.0 };
}

// ---- voice on/off, shared by every stage and remembered per browser ----
const KEY = "mochibo-voice";
let voiceOn = true;
try {
  if (typeof localStorage !== "undefined") voiceOn = localStorage.getItem(KEY) !== "off";
} catch {}
const voiceSubs = new Set<() => void>();

export const speechSupported = () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

export function setVoiceOn(on: boolean) {
  voiceOn = on;
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {}
  if (!on && speechSupported()) window.speechSynthesis.cancel();
  voiceSubs.forEach((f) => f());
}

export function useVoiceOn(): boolean {
  return useSyncExternalStore(
    (f) => {
      voiceSubs.add(f);
      return () => voiceSubs.delete(f);
    },
    () => voiceOn,
    () => true,
  );
}

/** Mobile Safari only allows speech that starts inside a tap. Call this from the click that starts a run. */
export function unlockSpeech() {
  if (!voiceOn || !speechSupported()) return;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  window.speechSynthesis.speak(u);
}

const PREFERRED = [/natural/i, /google us english/i, /samantha/i, /aria/i, /jenny/i, /google uk english female/i, /karen/i, /daniel/i];
function pickVoice(): SpeechSynthesisVoice | null {
  const all = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
  for (const re of PREFERRED) {
    const v = all.find((x) => re.test(x.name) && x.lang.toLowerCase().startsWith("en-us")) ?? all.find((x) => re.test(x.name));
    if (v) return v;
  }
  return all.find((v) => v.lang.toLowerCase() === "en-us") ?? all[0] ?? null;
}
if (typeof window !== "undefined" && speechSupported()) {
  // Chrome loads voices asynchronously; ask early so the first sentence has a good voice.
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", () => window.speechSynthesis.getVoices());
}

/** Text the bubble and the voice use: no markdown markers, no bullets. */
export function speakable(s: string): string {
  return s
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, "")
    .replace(/[*_#`>]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split finished sentences off the front of a buffer. Long sentences are cut at commas or spaces. */
export function takeSentences(buf: string, final: boolean): { sentences: string[]; rest: string } {
  const out: string[] = [];
  // Sticky, so sentences are taken only from the front. A "." inside "3.5" or "e.g" does not end one.
  const re = /(?:[^.!?\n]|[.!?]+(?=[^\s.!?]))*(?:[.!?]+["')\]]*(?=\s|$)|\n)/gy;
  let last = 0;
  for (const m of buf.matchAll(re)) {
    const end = (m.index ?? 0) + m[0].length;
    if (!final && end >= buf.length && !/\n$/.test(m[0])) break; // may still be growing ("3.5")
    out.push(m[0]);
    last = end;
  }
  let rest = buf.slice(last);
  if (final && rest.trim()) {
    out.push(rest);
    rest = "";
  }
  const pieces: string[] = [];
  for (const raw of out) {
    let s = speakable(raw);
    while (s.length > 150) {
      const cut = Math.max(s.lastIndexOf(", ", 140), s.lastIndexOf(" ", 140));
      const at = cut > 40 ? cut + 1 : 140;
      pieces.push(s.slice(0, at).trim());
      s = s.slice(at).trim();
    }
    if (s) pieces.push(s);
  }
  return { sentences: pieces, rest };
}

export class Talker {
  private queue: string[] = [];
  private buf = "";
  private ended = true;
  private busy = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private gen = 0;
  private actor: Actor | null = null;
  private profile: VoiceProfile = { pitch: 1, rate: 1 };
  private subs = new Set<() => void>();
  /** The sentence in the bubble, or null when the bubble is hidden. */
  text: string | null = null;

  constructor(readonly stage: Stage) {}

  subscribe = (f: () => void) => {
    this.subs.add(f);
    return () => this.subs.delete(f);
  };
  getText = () => this.text;
  /** The actor the bubble belongs to. */
  get speaker() {
    return this.actor;
  }

  /** Start a new speech (stops this and any other stage's speech). */
  begin(actor: Actor, profile: VoiceProfile) {
    // One voice at a time: starting here silences the other stage.
    for (const t of Object.values(talkers)) if (t && t !== this) t.stop();
    this.stop();
    this.actor = actor;
    this.profile = profile;
    this.ended = false;
  }

  push(chunk: string) {
    this.buf += chunk;
    const { sentences, rest } = takeSentences(this.buf, false);
    this.buf = rest;
    this.queue.push(...sentences);
    this.pump();
  }

  end() {
    const { sentences } = takeSentences(this.buf, true);
    this.buf = "";
    this.queue.push(...sentences);
    this.ended = true;
    this.pump();
  }

  say(actor: Actor, text: string, profile: VoiceProfile) {
    this.begin(actor, profile);
    this.push(text);
    this.end();
  }

  stop() {
    this.gen++;
    clearTimeout(this.timer);
    if (this.busy && speechSupported()) window.speechSynthesis.cancel();
    this.queue = [];
    this.buf = "";
    this.busy = false;
    this.ended = true;
    if (this.actor) this.actor.talking = false;
    this.show(null);
  }

  private show(t: string | null) {
    if (this.text === t) return;
    this.text = t;
    this.subs.forEach((f) => f());
  }

  private pump() {
    if (this.busy) return;
    const next = this.queue.shift();
    const g = this.gen;
    if (next === undefined) {
      if (this.actor) this.actor.talking = false;
      // Keep the last sentence up for a moment, then hide the bubble.
      if (this.ended) this.timer = setTimeout(() => g === this.gen && this.show(null), 1400);
      return;
    }
    clearTimeout(this.timer);
    this.busy = true;
    this.show(next);
    if (this.actor) this.actor.talking = true;
    const done = () => {
      if (g !== this.gen) return;
      this.busy = false;
      this.pump();
    };
    const readTime = Math.min(6000, Math.max(1400, next.length * 55));
    if (voiceOn && speechSupported()) {
      const u = new SpeechSynthesisUtterance(next);
      const v = pickVoice();
      if (v) u.voice = v;
      u.lang = v?.lang || "en-US";
      u.pitch = this.profile.pitch;
      u.rate = this.profile.rate;
      u.onend = done;
      // No usable voice, or voice switched off mid-sentence: keep the text up for a reading time.
      u.onerror = () => {
        clearTimeout(this.timer);
        this.timer = setTimeout(done, readTime);
      };
      window.speechSynthesis.speak(u);
      // Some browsers never fire onend (for example when a tab is hidden); do not get stuck.
      this.timer = setTimeout(done, 1500 + next.length * 120);
    } else {
      this.timer = setTimeout(done, readTime);
    }
  }
}

/** Re-render when the bubble text changes. */
export function useTalkerText(t: Talker | null): string | null {
  return useSyncExternalStore(
    (f) => (t ? t.subscribe(f) : () => {}),
    () => (t ? t.getText() : null),
    () => null,
  );
}

// One talker per stage slot, so the run flow can reach the studio's talker.
const talkers: Record<string, Talker | null> = {};
export const talkerFor = (slot: "hero" | "studio") => talkers[slot] ?? null;
export function registerTalker(slot: "hero" | "studio", t: Talker | null) {
  talkers[slot]?.stop();
  talkers[slot] = t;
}
