import QRCode from "qrcode";

/** Server-rendered QR code as inline SVG. The app scans the raw code value. */
export async function QrImage({ value, size = 240 }: { value: string; size?: number }) {
  const svg = await QRCode.toString(value, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#16131f", light: "#ffffff" } });
  return <div style={{ width: size, height: size }} className="[&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}
