import { ImageResponse } from "next/og";
import { LOGO_BRAND, loadLogoFont, logoFontOptions } from "@/lib/logo-font";

/* Favicon: буква Ш из лока на фирменной плашке (радиус ≈ 22 %, кегль ≈ 60 %). */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
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
          background: LOGO_BRAND,
          borderRadius: 7,
          color: "#fff",
          fontFamily: "Montserrat",
          fontWeight: 900,
          fontSize: 19,
          lineHeight: 1
        }}
      >
        Ш
      </div>
    ),
    { ...size, fonts: logoFontOptions(font) }
  );
}
