import { ArchMark } from "./ArchMark";

interface WalletCardPreviewProps {
  companyName: string;
  accentColor: string;
  logoUrl?: string | null;
}

const CARD_STYLE = {
  width: 240,
  height: 138,
  border: "1px solid rgba(20,18,14,0.07)",
  boxShadow: "0 12px 28px -10px rgba(20,18,14,0.22), 0 2px 4px rgba(20,18,14,0.05)",
};

/** Aperçu miniature de la carte Wallet (vue fermée) — une seule couleur, celle réellement
 * utilisée par la vraie carte Apple Wallet (fond uni, aucun dégradé/modèle possible). */
export function WalletCardPreview({ companyName, accentColor, logoUrl }: WalletCardPreviewProps) {
  const displayName = companyName.trim() || "NOM DE L'ENTREPRISE";

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

  return (
    <div
      className="rounded-2xl bg-white flex flex-col items-center justify-center gap-3 mx-auto"
      style={CARD_STYLE}
    >
      {logo}
      <div className="flex flex-col items-center gap-1.5">
        <div
          className="text-xs font-bold uppercase tracking-widest text-center px-4"
          style={{ fontFamily: "var(--font-display)", color: "#171512" }}
        >
          {displayName}
        </div>
        <div className="w-4 h-0.5 rounded-full" style={{ background: accentColor }} />
      </div>
    </div>
  );
}
