import { ArchMark } from "./ArchMark";

interface WalletCardPreviewProps {
  companyName: string;
  accentColor: string;
  secondaryColor?: string | null;
  logoPosition?: "CENTER" | "TOP" | "SIDE";
  logoUrl?: string | null;
}

/** Aperçu miniature de la carte Wallet (vue fermée) — même structure que le design validé en Phase 1,
 * personnalisable par entreprise : position du logo, et un dégradé optionnel à 2 couleurs max. */
export function WalletCardPreview({
  companyName,
  accentColor,
  secondaryColor,
  logoPosition = "CENTER",
  logoUrl,
}: WalletCardPreviewProps) {
  const displayName = companyName.trim() || "NOM DE L'ENTREPRISE";
  const barBackground = secondaryColor ? `linear-gradient(90deg, ${accentColor}, ${secondaryColor})` : accentColor;

  const logo = logoUrl ? (
    <img
      src={logoUrl}
      alt=""
      className="rounded-full object-cover flex-shrink-0"
      style={{ width: 32, height: 32, border: "1px solid rgba(20,18,14,0.1)" }}
    />
  ) : (
    <ArchMark size={32} color={accentColor} />
  );

  const nameBlock = (
    <div className={`flex flex-col gap-1.5 ${logoPosition === "SIDE" ? "items-start" : "items-center"}`}>
      <div
        className={`text-xs font-bold uppercase tracking-widest ${logoPosition === "SIDE" ? "text-left" : "text-center px-4"}`}
        style={{ fontFamily: "var(--font-display)", color: "#171512" }}
      >
        {displayName}
      </div>
      <div className="w-4 h-0.5 rounded-full" style={{ background: barBackground }} />
    </div>
  );

  const cardStyle = {
    width: 240,
    height: 138,
    border: "1px solid rgba(20,18,14,0.07)",
    boxShadow: "0 12px 28px -10px rgba(20,18,14,0.22), 0 2px 4px rgba(20,18,14,0.05)",
  };

  if (logoPosition === "SIDE") {
    return (
      <div className="rounded-2xl bg-white flex items-center justify-center gap-4 mx-auto px-6" style={cardStyle}>
        {logo}
        {nameBlock}
      </div>
    );
  }

  if (logoPosition === "TOP") {
    return (
      <div className="rounded-2xl bg-white flex flex-col items-start justify-between mx-auto p-5" style={cardStyle}>
        {logo}
        {nameBlock}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white flex flex-col items-center justify-center gap-3 mx-auto" style={cardStyle}>
      {logo}
      {nameBlock}
    </div>
  );
}
