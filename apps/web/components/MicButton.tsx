"use client";

/** Push-to-talk button: tap to speak, tap again (or pause) to send. Hidden where the browser has no voice input. */
export function MicButton({ supported, listening, disabled, onClick, className = "" }: { supported: boolean; listening: boolean; disabled?: boolean; onClick: () => void; className?: string }) {
  if (!supported) return null;
  return (
    <button
      type="button"
      className={`ibtn mic${listening ? " on" : ""} ${className}`}
      aria-label={listening ? "Stop listening" : "Talk to your agent"}
      aria-pressed={listening}
      title={listening ? "Listening… tap to send" : "Talk to your agent"}
      disabled={disabled}
      onClick={onClick}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
      </svg>
    </button>
  );
}
