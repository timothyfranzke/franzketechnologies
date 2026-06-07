import { useEffect, useState } from "react";

export default function OfflineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      className="font-mono"
      style={{
        background: "rgba(193, 74, 51, 0.12)",
        color: "var(--rust)",
        border: "1px solid var(--rust)",
        borderRadius: "0.5rem",
        padding: "0.55rem 0.75rem",
        marginBottom: "1rem",
        fontSize: "0.75rem",
        letterSpacing: "0.05em",
        textAlign: "center",
      }}
    >
      You're offline. Changes will sync when you reconnect.
    </div>
  );
}
