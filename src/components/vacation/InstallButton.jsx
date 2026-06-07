import { useEffect, useState } from "react";

const DISMISS_KEY = "franzke.vacation.installPromptDismissed";

function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  return isIos && isSafari;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

export default function InstallButton() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") {
        setDismissed(true);
        return;
      }
    } catch {}

    const handler = (e) => {
      e.preventDefault();
      setPromptEvent(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    if (isIosSafari()) setShowIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (dismissed) return null;
  if (typeof window !== "undefined" && isStandalone()) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setDismissed(true);
  };

  const install = async () => {
    if (!promptEvent) return;
    try {
      promptEvent.prompt();
      await promptEvent.userChoice;
    } catch {}
    dismiss();
  };

  if (promptEvent) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          background: "var(--paper)",
          border: "1px solid rgba(193, 74, 51, 0.25)",
          borderRadius: "0.6rem",
          padding: "0.75rem 0.85rem",
          marginBottom: "1.25rem",
        }}
      >
        <div className="font-body" style={{ fontSize: "0.9rem", color: "var(--ink)" }}>
          Install Vacation to your home screen for quick offline access.
        </div>
        <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
          <button type="button" className="btn-primary" onClick={install}>
            Install
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss install prompt"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--dusty)",
              fontSize: "1.1rem",
              cursor: "pointer",
              padding: "0 0.4rem",
            }}
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  if (showIosHint) {
    return (
      <div
        className="font-body"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          background: "var(--paper)",
          border: "1px dashed var(--dusty)",
          borderRadius: "0.6rem",
          padding: "0.65rem 0.85rem",
          marginBottom: "1.25rem",
          fontSize: "0.85rem",
          color: "var(--ink)",
        }}
      >
        <span>
          To install: tap <strong>Share</strong> → <strong>Add to Home Screen</strong>.
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install hint"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--dusty)",
            fontSize: "1.1rem",
            cursor: "pointer",
            padding: "0 0.4rem",
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>
    );
  }

  return null;
}
