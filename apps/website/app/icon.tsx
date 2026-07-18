import { ImageResponse } from "next/og";

export const size = { width: 96, height: 96 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        borderRadius: "22px",
        background: "#126b73",
        color: "#ffffff",
        fontFamily: "Arial, sans-serif",
        fontSize: "58px",
        fontWeight: 800,
      }}
    >
      A
    </div>,
    size,
  );
}
