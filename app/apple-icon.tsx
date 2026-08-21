import { ImageResponse } from "next/og";
import { LOGO_BRAND, loadLogoFont, logoFontOptions } from "@/lib/logo-font";

/* Иконка приложения (180 px): та же композиция, что favicon. iOS сам скругляет
   углы, поэтому плашка заливается целиком. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
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
          color: "#fff",
          fontFamily: "Montserrat",
          fontWeight: 900,
          fontSize: 108,
          lineHeight: 1
        }}
      >
        Ш
      </div>
    ),
    { ...size, fonts: logoFontOptions(font) }
  );
}
