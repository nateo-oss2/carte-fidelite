import { ArchMark } from "./ArchMark";

export type CardTemplate = "BANNER" | "GRADIENT" | "FRAME" | "SPLIT";

interface WalletCardPreviewProps {
  companyName: string;
  accentColor: string;
  secondaryColor?: string | null;
  cardTemplate?: CardTemplate;
  logoUrl?: string | null;
}

const CARD_STYLE = {
  width: 240,
  height: 138,
  border: "1px solid rgba(20,18,14,0.07)",
  boxShadow: "0 12px 28px -10px rgba(20,18,14,0.22), 0 2px 4px rgba(20,18,14,0.05)",
};

function Logo({ logoUrl, tone }: { logoUrl?: string | null; tone: "light" | "dark" }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: 32, height: 32, border: "1px solid rgba(255,255,255,0.4)" }}
      />
    );
  }
  return <ArchMark size={32} color={tone === "light" ? "#ffffff" : "#171512"} />;
}

/** Aperçu miniature de la carte Wallet (vue fermée), personnalisable par entreprise : modèle
 * visuel (chacun applique les couleurs sur toute la carte, pas seulement un trait décoratif),
 * couleur principale, 2e couleur optionnelle, et logo. */
export function WalletCardPreview({
  companyName,
  accentColor,
  secondaryColor,
  cardTemplate = "BANNER",
  logoUrl,
}: WalletCardPreviewProps) {
  const displayName = companyName.trim() || "NOM DE L'ENTREPRISE";
  const gradient = secondaryColor ? `linear-gradient(135deg, ${accentColor}, ${secondaryColor})` : accentColor;

  if (cardTemplate === "GRADIENT") {
    return (
      <div
        className="rounded-2xl flex flex-col items-start justify-between mx-auto p-5"
        style={{ ...CARD_STYLE, background: gradient }}
      >
        <Logo logoUrl={logoUrl} tone="light" />
        <div
          className="text-xs font-bold uppercase tracking-widest text-white text-left"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {displayName}
        </div>
      </div>
    );
  }

  if (cardTemplate === "FRAME") {
    return (
      <div className="rounded-2xl mx-auto p-2" style={{ ...CARD_STYLE, background: gradient }}>
        <div className="rounded-xl bg-white w-full h-full flex flex-col items-center justify-center gap-3">
          <Logo logoUrl={logoUrl} tone="dark" />
          <div
            className="text-xs font-bold uppercase tracking-widest text-center px-4"
            style={{ fontFamily: "var(--font-display)", color: "#171512" }}
          >
            {displayName}
          </div>
        </div>
      </div>
    );
  }

  if (cardTemplate === "SPLIT") {
    return (
      <div className="rounded-2xl mx-auto flex overflow-hidden" style={CARD_STYLE}>
        <div className="w-2/5 h-full flex items-center justify-center" style={{ background: accentColor }}>
          <Logo logoUrl={logoUrl} tone="light" />
        </div>
        <div
          className="w-3/5 h-full flex items-center justify-center px-3"
          style={{ background: secondaryColor ?? "#ffffff" }}
        >
          <div
            className="text-xs font-bold uppercase tracking-widest text-center"
            style={{
              fontFamily: "var(--font-display)",
              color: secondaryColor ? "#ffffff" : "#171512",
            }}
          >
            {displayName}
          </div>
        </div>
      </div>
    );
  }

  // BANNER (défaut)
  return (
    <div className="rounded-2xl bg-white mx-auto flex flex-col overflow-hidden" style={CARD_STYLE}>
      <div className="flex items-center px-4 py-3" style={{ background: gradient }}>
        <Logo logoUrl={logoUrl} tone="light" />
      </div>
      <div className="flex-1 flex items-center justify-center px-4">
        <div
          className="text-xs font-bold uppercase tracking-widest text-center"
          style={{ fontFamily: "var(--font-display)", color: "#171512" }}
        >
          {displayName}
        </div>
      </div>
    </div>
  );
}
