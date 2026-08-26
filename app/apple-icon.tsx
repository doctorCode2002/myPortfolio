import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Next's apple-icon convention only accepts raster formats, so the monogram is
// rasterised here rather than shipped as the SVG used for `icon.svg`.
export default function AppleIcon(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#14110F",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 100 100" fill="none">
          <path d="M22 18 L50 34 L78 18 L78 34 L50 50 L22 34 Z" fill="#F5F2E9" />
          <path d="M22 38 L38 47 L38 78 L30 84 L22 78 Z" fill="#F5F2E9" />
          <path d="M78 38 L78 78 L70 84 L62 78 L62 47 Z" fill="#F5F2E9" />
          <path d="M43 45 L50 49 L57 45 L57 62 L50 67 L43 62 Z" fill="#F5F2E9" />
        </svg>
      </div>
    ),
    size
  );
}
