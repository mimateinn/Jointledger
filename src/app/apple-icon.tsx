import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#121411",
          color: "#7A9A8A",
          fontSize: 86,
          fontWeight: 600,
        }}
      >
        倉
      </div>
    ),
    size,
  );
}
