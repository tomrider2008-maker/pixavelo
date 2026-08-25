interface PixaveloLogoProps {
  readonly compact?: boolean;
}

export function PixaveloLogo({ compact = false }: PixaveloLogoProps) {
  return (
    <span className="brand" aria-label="Pixavelo">
      <svg className="brand__mark" viewBox="0 0 40 40" aria-hidden="true">
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M20 2.4 35.2 11v18L20 37.6 4.8 29V11L20 2.4Zm0 6.2-9.8 5.6v11.6l9.8 5.6 9.8-5.6V14.2L20 8.6Z"
        />
        <path
          className="brand__facet"
          d="m20 8.6 9.8 5.6L20 20 10.2 14.2 20 8.6Zm0 11.4 9.8-5.8v11.6L20 31.4V20Z"
        />
      </svg>
      <span className="brand__name">Pixavelo</span>
      {compact ? null : <span className="brand__descriptor">Private Image Processing Studio</span>}
    </span>
  );
}
