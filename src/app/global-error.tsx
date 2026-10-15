"use client";

/** Last-resort error page (root layout failed). Kept dependency-free. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          background: "#f7f8f5",
          color: "#172b26",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
        }}
      >
        <main style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20 }}>JobTrack is having trouble</h1>
          <p style={{ color: "#75837f", fontSize: 14 }}>Please try again in a moment.</p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "8px 14px",
              borderRadius: 9,
              border: 0,
              background: "#126d50",
              color: "white",
              fontWeight: 700,
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
