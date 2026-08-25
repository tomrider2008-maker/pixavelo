interface PixaveloLogoProps {
  readonly compact?: boolean;
}

export function PixaveloLogo({ compact = false }: PixaveloLogoProps) {
  return (
    <span className="brand" aria-label="Pixavelo">
      <svg className="brand__mark" viewBox="0 0 40 40" aria-hidden="true">
        <path fill="currentColor" d="M5 3h17c8 0 13 4.8 13 12s-5 12-13 12h-7v10H5V3Z" />
        <path className="brand__cutout" d="M15 11h7c2.4 0 4 1.4 4 4s-1.6 4-4 4h-7v-8Z" />
      </svg>
      <span className="brand__name">Pixavelo</span>
      {compact ? null : <span className="brand__descriptor">Private Image Processing Studio</span>}
    </span>
  );
}
