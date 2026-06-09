import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "WITCH'S TERMINAL";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#000000",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: 1080,
            height: 510,
            padding: "56px 64px",
            border: "1px solid #00FF41",
            borderRadius: 45,
            color: "#00FF41",
            fontFamily: "monospace",
          }}
        >
          <div style={{ fontSize: 30, opacity: 0.7 }}>&gt; SYSTEM ONLINE</div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 28 }}>
            <span style={{ fontSize: 92, fontWeight: 700, letterSpacing: -2 }}>
              WITCH&apos;S TERMINAL
            </span>
            <span style={{ fontSize: 88, marginLeft: 14 }}>_</span>
          </div>
          <div style={{ fontSize: 34, marginTop: 36, opacity: 0.85 }}>
            // the witch reads patterns, not feelings.
          </div>
          <div style={{ fontSize: 26, marginTop: "auto", opacity: 0.55 }}>
            by Coding witch
          </div>
        </div>
      </div>
    ),
    size,
  );
}