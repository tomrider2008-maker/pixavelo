import { Calculator, Clipboard, HardDrive } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { formatBytes } from '../../utils/format';
import { calculateRatio, scaleDimensions } from './utilityModel';

export function CalculatorsUtility({
  onReadyChange
}: {
  readonly onReadyChange: (ready: boolean) => void;
}) {
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [targetWidth, setTargetWidth] = useState(1280);
  const [files, setFiles] = useState(100);
  const [averageBytes, setAverageBytes] = useState(350 * 1024);
  useEffect(() => onReadyChange(true), [onReadyChange]);
  const ratio = useMemo(() => calculateRatio(width, height), [height, width]);
  const scaled = useMemo(
    () => scaleDimensions(width, height, targetWidth),
    [height, targetWidth, width]
  );
  const rgbaBytes = Math.max(1, width) * Math.max(1, height) * 4;
  const summary = `${width}×${height} = ${ratio.width}:${ratio.height}; ${targetWidth}px wide = ${scaled.width}×${scaled.height}; RGBA memory ≈ ${formatBytes(rgbaBytes)}.`;
  return (
    <section className="utility-mode-panel calculator-utility" aria-labelledby="calculators-title">
      <header>
        <h2 id="calculators-title">Image calculators</h2>
        <p>Calculate aspect ratios, proportional dimensions, decoded memory and package storage.</p>
      </header>
      <div className="calculator-grid">
        <section>
          <Calculator size={24} />
          <h3>Dimensions &amp; ratio</h3>
          <div className="utility-number-grid">
            <label>
              <span>Width</span>
              <input
                type="number"
                min="1"
                max="32768"
                value={width}
                onChange={(event) => setWidth(event.currentTarget.valueAsNumber || 1)}
              />
            </label>
            <label>
              <span>Height</span>
              <input
                type="number"
                min="1"
                max="32768"
                value={height}
                onChange={(event) => setHeight(event.currentTarget.valueAsNumber || 1)}
              />
            </label>
            <label>
              <span>Target width</span>
              <input
                type="number"
                min="1"
                max="32768"
                value={targetWidth}
                onChange={(event) => setTargetWidth(event.currentTarget.valueAsNumber || 1)}
              />
            </label>
          </div>
          <dl>
            <div>
              <dt>Simplified ratio</dt>
              <dd>
                {ratio.width}:{ratio.height}
              </dd>
            </div>
            <div>
              <dt>Scaled output</dt>
              <dd>
                {scaled.width} × {scaled.height}
              </dd>
            </div>
            <div>
              <dt>RGBA decode memory</dt>
              <dd>{formatBytes(rgbaBytes)}</dd>
            </div>
          </dl>
        </section>
        <section>
          <HardDrive size={24} />
          <h3>Batch storage</h3>
          <div className="utility-number-grid">
            <label>
              <span>File count</span>
              <input
                type="number"
                min="1"
                max="100000"
                value={files}
                onChange={(event) => setFiles(event.currentTarget.valueAsNumber || 1)}
              />
            </label>
            <label>
              <span>Average KB</span>
              <input
                type="number"
                min="1"
                max="1000000"
                value={Math.round(averageBytes / 1024)}
                onChange={(event) =>
                  setAverageBytes((event.currentTarget.valueAsNumber || 1) * 1024)
                }
              />
            </label>
          </div>
          <dl>
            <div>
              <dt>Estimated package</dt>
              <dd>{formatBytes(files * averageBytes)}</dd>
            </div>
            <div>
              <dt>Uncompressed pixels</dt>
              <dd>{formatBytes(files * rgbaBytes)}</dd>
            </div>
          </dl>
        </section>
      </div>
      <button
        data-utility-primary
        className="button button--primary calculator-copy"
        type="button"
        onClick={() => void navigator.clipboard.writeText(summary)}
      >
        <Clipboard size={16} /> Copy calculated summary
      </button>
    </section>
  );
}
