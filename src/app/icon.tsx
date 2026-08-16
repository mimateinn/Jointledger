import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

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
          background: "#121411",
          color: "#7A9A8A",
          fontSize: 92,
          fontWeight: 600,
        }}
      >
        倉
      </div>
    ),
    size,
  );
}
