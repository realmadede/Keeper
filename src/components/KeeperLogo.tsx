interface KeeperLogoProps {
  size?: number;
  className?: string;
}

/**
 * Keeper brand emblem: an obsidian Liquid Glass squircle containing a
 * brushed-gold house silhouette with a carved keyhole — symbolizing one
 * shared home, one safeguarded budget, and complete transparency.
 */
export function KeeperLogo({ size = 40, className }: KeeperLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      fill="none"
      aria-label="Keeper logo"
      className={className}
    >
      <defs>
        <linearGradient id="keeper-logo-bg" x1="64" y1="32" x2="448" y2="480" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2A2A30" />
          <stop offset="55%" stopColor="#1B1B1F" />
          <stop offset="100%" stopColor="#111114" />
        </linearGradient>
        <radialGradient
          id="keeper-logo-sheen"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(150 96) rotate(48) scale(340)"
        >
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.16" />
          <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.03" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="keeper-logo-rim" x1="96" y1="24" x2="416" y2="488" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.28" />
          <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#BFA377" stopOpacity="0.22" />
        </linearGradient>
        <linearGradient id="keeper-logo-gold" x1="148" y1="112" x2="368" y2="396" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F3DFBA" />
          <stop offset="52%" stopColor="#C9AC7C" />
          <stop offset="100%" stopColor="#A68756" />
        </linearGradient>
      </defs>

      <rect x="16" y="16" width="480" height="480" rx="116" fill="url(#keeper-logo-bg)" />
      <rect x="16" y="16" width="480" height="480" rx="116" fill="url(#keeper-logo-sheen)" />
      <rect x="19" y="19" width="474" height="474" rx="113" stroke="url(#keeper-logo-rim)" strokeWidth="6" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="url(#keeper-logo-gold)"
        d="M242.5 113.8C250.3 107.2 261.7 107.2 269.5 113.8L392.4 217.5C402.9 226.4 396.6 243.5 382.9 243.5H364V362C364 380.8 348.8 396 330 396H182C163.2 396 148 380.8 148 362V243.5H129.1C115.4 243.5 109.1 226.4 119.6 217.5L242.5 113.8ZM256 226C235.6 226 219 242.6 219 263C219 276.6 226.4 288.5 237.4 294.9L229.1 346.6C228.1 352.9 232.9 358.5 239.2 358.5H272.8C279.1 358.5 283.9 352.9 282.9 346.6L274.6 294.9C285.6 288.5 293 276.6 293 263C293 242.6 276.4 226 256 226Z"
      />
    </svg>
  );
}
