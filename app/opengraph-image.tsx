import { ImageResponse } from "next/og";
import { LOGO_BRAND, LOGO_INK, loadLogoFont, logoFontOptions } from "@/lib/logo-font";

/* og:image — лок «ШБЗШкола» на белом фоне. */
export const alt = "ШБЗ Школа";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const font = await loadLogoFont();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          fontFamily: "Montserrat",
          fontWeight: 900,
          fontSize: 160,
          letterSpacing: "-0.015em",
          lineHeight: 1,
          color: LOGO_INK
        }}
      >
        <span>ШБЗ</span>
        <span style={{ color: LOGO_BRAND }}>Школа</span>
      </div>
    ),
    { ...size, fonts: logoFontOptions(font) }
  );
}
