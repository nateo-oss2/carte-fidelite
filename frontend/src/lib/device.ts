export type WalletPlatform = "apple" | "google" | "unknown";

export function detectWalletPlatform(): WalletPlatform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) {
    return "apple";
  }
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) {
    // iPad en mode "Demander la version bureau"
    return "apple";
  }
  if (/Android/.test(ua)) {
    return "google";
  }
  return "unknown";
}
