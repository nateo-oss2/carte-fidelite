import QRCode from "qrcode";

/** Génère un QR code PNG encodant l'URL donnée — utilisé pour le QR code d'inscription de chaque entreprise. */
export function generateQrCodePng(data: string): Promise<Buffer> {
  return QRCode.toBuffer(data, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
    color: { dark: "#171512", light: "#FFFFFFFF" },
  });
}
