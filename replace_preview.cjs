const fs = require('fs');
const file = 'src/features/optimize/OptimizePage.tsx';
let code = fs.readFileSync(file, 'utf8');

const startStr = 'function ComparisonPreview({';
const endStr = 'function formatTargetPreset(kb: number) {';

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr);

if (startIndex === -1 || endIndex === -1) {
  console.log('Could not find boundaries');
  process.exit(1);
}

const replacement = `function ComparisonPreview({
  sourceUrl,
  outputUrl,
  comparison,
  onChange
}: {
  readonly sourceUrl: string | undefined;
  readonly outputUrl: string | undefined;
  readonly comparison: number;
  readonly onChange: (value: number) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const imageUrl = outputUrl ?? sourceUrl;

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(Math.max(1, z * delta), 10));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    setIsPanning(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPanning || zoom === 1) return;
    setPan((p) => ({ x: p.x + e.movementX, y: p.y + e.movementY }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsPanning(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleDoubleClick = () => {
    setZoom((z) => (z > 1 ? 1 : 2.5));
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="phase5-comparison-wrapper">
      <div className="comparison-toolbar">
        <label className="diff-toggle" title="Highlight compression artifacts">
          <input type="checkbox" checked={showDiff} onChange={(e) => setShowDiff(e.target.checked)} />
          <Wand2 size={14} /> Artifact Diff Mode
        </label>
        {zoom > 1 && <span className="zoom-indicator">{Math.round(zoom * 100)}%</span>}
      </div>
      <div
        className="phase5-comparison"
        aria-label="Image comparison preview"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
      >
        <div
          className="comparison-pan-layer"
          style={{ transform: \`translate(\${pan.x}px, \${pan.y}px) scale(\${zoom})\`, transformOrigin: 'center', width: '100%', height: '100%' }}
        >
          {sourceUrl ? (
            <img className="phase5-comparison__original" src={sourceUrl} alt="Original preview" draggable={false} />
          ) : (
            <div className="phase5-comparison__placeholder">Preview becomes available after local decoding.</div>
          )}

          {imageUrl ? (
            <div
              className="phase5-comparison__output"
              style={{ clipPath: \`inset(0 0 0 \${comparison}%)\` }}
            >
              <img src={imageUrl} alt="Optimized preview" draggable={false} />
            </div>
          ) : null}

          {showDiff && imageUrl && sourceUrl && (
            <div
              className="phase5-comparison__diff"
              style={{ clipPath: \`inset(0 0 0 \${comparison}%)\` }}
            >
              <img src={imageUrl} alt="Diff overlay" draggable={false} />
            </div>
          )}
        </div>

        <span className="phase5-comparison__label phase5-comparison__label--original">Original</span>
        <span className="phase5-comparison__label phase5-comparison__label--output">
          {outputUrl ? 'Optimized' : 'Output preview'}
        </span>
        <span className="phase5-comparison__divider" style={{ left: \`\${comparison}%\` }} aria-hidden="true" />
        <input
          aria-label="Compare original and optimized image"
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={comparison}
          onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
        />
      </div>
    </div>
  );
}

`;

code = code.substring(0, startIndex) + replacement + code.substring(endIndex);
fs.writeFileSync(file, code);
console.log('Replaced successfully');
