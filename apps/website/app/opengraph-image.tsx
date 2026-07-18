import { ImageResponse } from "next/og";

export const alt =
  "Class A Bridge by Ancilis — turn your SOC 2 Type II into a clear FedRAMP Class A plan";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#f4f7f5",
        color: "#10253a",
        padding: "70px 76px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          border: "2px solid #c6d6d2",
          borderRadius: "30px",
          background: "#ffffff",
          padding: "54px 60px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "22px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "78px",
              height: "78px",
              borderRadius: "20px",
              background: "#126b73",
              color: "#ffffff",
              fontSize: "44px",
              fontWeight: 800,
            }}
          >
            A
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "33px", fontWeight: 800, letterSpacing: "1px" }}>
              CLASS A BRIDGE
            </span>
            <span style={{ color: "#506779", fontSize: "20px", letterSpacing: "3px" }}>
              BY ANCILIS · OPEN SOURCE
            </span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          <span style={{ color: "#126b73", fontSize: "22px", fontWeight: 700 }}>
            LOCAL-FIRST FEDRAMP 20X PREPARATION
          </span>
          <span
            style={{
              maxWidth: "930px",
              fontSize: "54px",
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-1.5px",
            }}
          >
            Turn your SOC 2 Type II into a clear FedRAMP Class A plan.
          </span>
        </div>
        <div style={{ display: "flex", gap: "28px", color: "#506779", fontSize: "21px" }}>
          <span>Open source</span>
          <span>·</span>
          <span>Local-first</span>
          <span>·</span>
          <span>Built for compliance teams</span>
        </div>
      </div>
    </div>,
    size,
  );
}
