import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// Platzhalter-Marke im dokumentierten Design (siehe README, globals.css) —
// bis ein eigenes Logo-Asset vorliegt. Bewusst schlicht: Akzentfarbe als
// Fläche, Wordmark-Initiale in Weiss. Kein eigenes borderRadius — Browser/
// OS wenden ihre eigene Icon-Maskierung an (v.a. relevant für apple-icon.tsx,
// wo iOS sonst doppelt rundet).
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#3d5afe",
          color: "#fafafa",
          fontSize: 320,
          fontWeight: 600,
        }}
      >
        C
      </div>
    ),
    { ...size },
  );
}
