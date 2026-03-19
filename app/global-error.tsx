"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          backgroundColor: "#fff",
          color: "#111",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            maxWidth: 400,
            width: "100%",
            padding: 24,
            border: "1px solid #e5e5e5",
            borderRadius: 16,
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Terjadi Kesalahan
          </h1>
          <p style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>
            Maaf, terjadi kesalahan yang tidak terduga.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "8px 24px",
              fontSize: 14,
              fontWeight: 500,
              color: "#fff",
              backgroundColor: "#0d9488",
              border: "none",
              borderRadius: 9999,
              cursor: "pointer",
            }}
          >
            Coba Lagi
          </button>
        </div>
      </body>
    </html>
  );
}
