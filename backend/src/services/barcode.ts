import bwipjs from "bwip-js";

/** Génère l'image PNG du code-barres Code128 encodant la valeur donnée (le token du client). */
export function generateBarcodePng(value: string): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: "code128",
    text: value,
    scale: 3,
    height: 14,
    includetext: false,
    backgroundcolor: "FFFFFF",
  });
}
