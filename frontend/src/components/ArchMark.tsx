interface ArchMarkProps {
  size?: number;
  color?: string;
}

/** Le monogramme minimaliste utilisé sur la carte Wallet (Phase 1) — repris ici pour cohérence visuelle. */
export function ArchMark({ size = 44, color = "#171512" }: ArchMarkProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `1.4px solid ${color}8c`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 36 36" fill="none">
        <path
          d="M8,27 V15 a10,10 0 0 1 20,0 V27"
          stroke={color}
          strokeWidth={2.6}
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
