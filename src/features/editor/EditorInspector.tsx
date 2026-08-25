import {
  FlipHorizontal2,
  FlipVertical2,
  History as HistoryIcon,
  RotateCcw,
  RotateCw
} from 'lucide-react';
import { useState } from 'react';
import { fitCropToAspect } from '../resize/cropMath';
import type { EditorHistoryState } from './history';
import type { EditorExportSettings, EditorRecipe, EditorTool } from './types';

interface EditorInspectorProps {
  readonly activeTool: EditorTool;
  readonly panel: 'adjust' | 'history';
  readonly history: EditorHistoryState;
  readonly output: EditorExportSettings;
  readonly onPanel: (panel: 'adjust' | 'history') => void;
  readonly onApply: (recipe: EditorRecipe, label: string, group?: string) => void;
  readonly onOutput: (output: EditorExportSettings) => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onResetTool: () => void;
  readonly onRestoreOriginal: () => void;
}

const LIGHT_KEYS = ['exposure', 'brightness', 'contrast', 'highlights', 'shadows'] as const;
const COLOR_KEYS = ['saturation', 'temperature', 'tint'] as const;
const DETAIL_KEYS = ['gamma', 'sharpness', 'blur'] as const;

export function EditorInspector({
  activeTool,
  panel,
  history,
  output,
  onPanel,
  onApply,
  onOutput,
  onUndo,
  onRedo,
  onResetTool,
  onRestoreOriginal
}: EditorInspectorProps) {
  const recipe = history.present;

  return (
    <aside className="editor-inspector" aria-label="Editor controls">
      <div className="editor-inspector__tabs" role="tablist" aria-label="Editor inspector">
        <button
          type="button"
          role="tab"
          aria-selected={panel === 'adjust'}
          onClick={() => onPanel('adjust')}
        >
          Adjust
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={panel === 'history'}
          onClick={() => onPanel('history')}
        >
          History
        </button>
      </div>

      <div className="editor-inspector__body">
        {panel === 'history' ? (
          <HistoryPanel history={history} onUndo={onUndo} onRedo={onRedo} />
        ) : activeTool === 'crop' ? (
          <CropControls
            recipe={recipe}
            sourceWidth={history.original.canvas.width}
            sourceHeight={history.original.canvas.height}
            onApply={onApply}
          />
        ) : activeTool === 'rotate' ? (
          <RotateControls recipe={recipe} onApply={onApply} />
        ) : activeTool === 'flip' ? (
          <FlipControls recipe={recipe} onApply={onApply} />
        ) : activeTool === 'canvas' ? (
          <CanvasControls recipe={recipe} onApply={onApply} />
        ) : (
          <AdjustmentControls recipe={recipe} onApply={onApply} />
        )}

        {panel === 'adjust' ? (
          <>
            <GeometrySummary recipe={recipe} />
            <fieldset className="editor-output-controls">
              <legend>Export</legend>
              <label>
                <span>Format</span>
                <select
                  value={output.format}
                  onChange={(event) =>
                    onOutput({
                      ...output,
                      format: event.currentTarget.value as typeof output.format
                    })
                  }
                >
                  <option value="webp">WebP</option>
                  <option value="jpeg">JPEG</option>
                  <option value="png">PNG</option>
                </select>
              </label>
              <label className="editor-quality-control">
                <span>
                  Quality <output>{output.quality}</output>
                </span>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={output.quality}
                  disabled={output.format === 'png'}
                  onChange={(event) =>
                    onOutput({ ...output, quality: event.currentTarget.valueAsNumber })
                  }
                />
              </label>
            </fieldset>
          </>
        ) : null}
      </div>

      <footer className="editor-inspector__footer">
        <button className="button button--secondary" type="button" onClick={onResetTool}>
          Reset adjustment
        </button>
        <button className="button button--secondary" type="button" onClick={onRestoreOriginal}>
          Restore original
        </button>
      </footer>
    </aside>
  );
}

function CropControls({
  recipe,
  sourceWidth,
  sourceHeight,
  onApply
}: {
  readonly recipe: EditorRecipe;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly onApply: EditorInspectorProps['onApply'];
}) {
  const applyAspect = (ratio: number | 'original') => {
    const crop =
      ratio === 'original'
        ? { x: 0, y: 0, width: sourceWidth, height: sourceHeight }
        : fitCropToAspect(sourceWidth, sourceHeight, ratio);
    onApply({ ...recipe, crop }, ratio === 'original' ? 'Restore crop' : 'Aspect crop');
  };

  return (
    <fieldset className="editor-control-section">
      <legend>Crop</legend>
      <p>Drag the frame or choose an exact aspect.</p>
      <div className="editor-aspect-options">
        <button type="button" onClick={() => applyAspect('original')}>
          Original
        </button>
        <button type="button" onClick={() => applyAspect(1)}>
          1:1
        </button>
        <button type="button" onClick={() => applyAspect(4 / 3)}>
          4:3
        </button>
        <button type="button" onClick={() => applyAspect(16 / 9)}>
          16:9
        </button>
      </div>
      <div className="editor-number-grid">
        {(['x', 'y', 'width', 'height'] as const).map((key) => (
          <NumberField
            key={key}
            label={key === 'x' || key === 'y' ? key.toUpperCase() : capitalize(key)}
            value={recipe.crop[key]}
            minimum={key === 'width' || key === 'height' ? 1 : 0}
            onChange={(value) =>
              onApply(
                { ...recipe, crop: { ...recipe.crop, [key]: Math.round(value) } },
                'Crop bounds',
                `crop-${key}`
              )
            }
          />
        ))}
      </div>
    </fieldset>
  );
}

function RotateControls({
  recipe,
  onApply
}: {
  readonly recipe: EditorRecipe;
  readonly onApply: EditorInspectorProps['onApply'];
}) {
  const rotate = (degrees: number, label: string) =>
    onApply({ ...recipe, rotation: normalizeDegrees(recipe.rotation + degrees) }, label);
  return (
    <fieldset className="editor-control-section">
      <legend>Rotate & straighten</legend>
      <div className="editor-action-pair">
        <button type="button" onClick={() => rotate(-90, 'Rotate left')}>
          <RotateCcw size={16} /> Rotate left
        </button>
        <button type="button" onClick={() => rotate(90, 'Rotate right')}>
          <RotateCw size={16} /> Rotate right
        </button>
      </div>
      <RangeControl
        label="Angle"
        value={recipe.rotation}
        min={-180}
        max={180}
        step={0.1}
        suffix="°"
        onChange={(value) =>
          onApply({ ...recipe, rotation: value }, 'Straighten image', 'rotation-angle')
        }
      />
      <p>Use small angle changes to straighten horizons. The output expands without clipping.</p>
    </fieldset>
  );
}

function FlipControls({
  recipe,
  onApply
}: {
  readonly recipe: EditorRecipe;
  readonly onApply: EditorInspectorProps['onApply'];
}) {
  return (
    <fieldset className="editor-control-section">
      <legend>Flip</legend>
      <div className="editor-action-pair">
        <button
          type="button"
          aria-pressed={recipe.flipHorizontal}
          onClick={() =>
            onApply({ ...recipe, flipHorizontal: !recipe.flipHorizontal }, 'Flip horizontal')
          }
        >
          <FlipHorizontal2 size={17} /> Horizontal
        </button>
        <button
          type="button"
          aria-pressed={recipe.flipVertical}
          onClick={() =>
            onApply({ ...recipe, flipVertical: !recipe.flipVertical }, 'Flip vertical')
          }
        >
          <FlipVertical2 size={17} /> Vertical
        </button>
      </div>
    </fieldset>
  );
}

function CanvasControls({
  recipe,
  onApply
}: {
  readonly recipe: EditorRecipe;
  readonly onApply: EditorInspectorProps['onApply'];
}) {
  return (
    <fieldset className="editor-control-section">
      <legend>Canvas resize</legend>
      <label className="editor-check-control">
        <input
          type="checkbox"
          checked={recipe.canvas.enabled}
          onChange={(event) =>
            onApply(
              { ...recipe, canvas: { ...recipe.canvas, enabled: event.currentTarget.checked } },
              'Canvas resize'
            )
          }
        />
        Enable custom canvas
      </label>
      <div className="editor-number-grid">
        <NumberField
          label="Width"
          value={recipe.canvas.width}
          minimum={1}
          onChange={(value) =>
            onApply(
              {
                ...recipe,
                canvas: { ...recipe.canvas, enabled: true, width: Math.round(value) }
              },
              'Canvas width',
              'canvas-width'
            )
          }
        />
        <NumberField
          label="Height"
          value={recipe.canvas.height}
          minimum={1}
          onChange={(value) =>
            onApply(
              {
                ...recipe,
                canvas: { ...recipe.canvas, enabled: true, height: Math.round(value) }
              },
              'Canvas height',
              'canvas-height'
            )
          }
        />
      </div>
      <label className="editor-color-control">
        <span>Background</span>
        <input
          type="color"
          value={recipe.canvas.background}
          onChange={(event) =>
            onApply(
              {
                ...recipe,
                canvas: {
                  ...recipe.canvas,
                  enabled: true,
                  background: event.currentTarget.value
                }
              },
              'Canvas background',
              'canvas-background'
            )
          }
        />
      </label>
    </fieldset>
  );
}

function AdjustmentControls({
  recipe,
  onApply
}: {
  readonly recipe: EditorRecipe;
  readonly onApply: EditorInspectorProps['onApply'];
}) {
  const [wideInspector] = useState(() => window.innerWidth > 860);
  const setAdjustment = (
    key: keyof EditorRecipe['adjustments'],
    value: number | boolean,
    label: string
  ) =>
    onApply(
      { ...recipe, adjustments: { ...recipe.adjustments, [key]: value } },
      label,
      `adjust-${key}`
    );
  const resetKeys = (keys: readonly (keyof EditorRecipe['adjustments'])[], label: string) => {
    const next = { ...recipe.adjustments };
    for (const key of keys) next[key] = historyOriginalValue(key) as never;
    onApply({ ...recipe, adjustments: next }, label);
  };

  return (
    <>
      <AdjustmentGroup title="Light" open onReset={() => resetKeys(LIGHT_KEYS, 'Reset light')}>
        <RangeControl
          label="Exposure"
          value={recipe.adjustments.exposure}
          min={-3}
          max={3}
          step={0.05}
          onChange={(value) => setAdjustment('exposure', value, 'Exposure')}
        />
        <RangeControl
          label="Brightness"
          value={recipe.adjustments.brightness}
          min={-100}
          max={100}
          onChange={(value) => setAdjustment('brightness', value, 'Brightness')}
        />
        <RangeControl
          label="Contrast"
          value={recipe.adjustments.contrast}
          min={-100}
          max={100}
          onChange={(value) => setAdjustment('contrast', value, 'Contrast')}
        />
        <RangeControl
          label="Highlights"
          value={recipe.adjustments.highlights}
          min={-100}
          max={100}
          onChange={(value) => setAdjustment('highlights', value, 'Highlights')}
        />
        <RangeControl
          label="Shadows"
          value={recipe.adjustments.shadows}
          min={-100}
          max={100}
          onChange={(value) => setAdjustment('shadows', value, 'Shadows')}
        />
      </AdjustmentGroup>
      <AdjustmentGroup
        title="Color"
        open={wideInspector}
        onReset={() => resetKeys(COLOR_KEYS, 'Reset color')}
      >
        <RangeControl
          label="Saturation"
          value={recipe.adjustments.saturation}
          min={-100}
          max={100}
          onChange={(value) => setAdjustment('saturation', value, 'Saturation')}
        />
        <RangeControl
          label="Temperature"
          value={recipe.adjustments.temperature}
          min={-100}
          max={100}
          onChange={(value) => setAdjustment('temperature', value, 'Temperature')}
        />
        <RangeControl
          label="Tint"
          value={recipe.adjustments.tint}
          min={-100}
          max={100}
          onChange={(value) => setAdjustment('tint', value, 'Tint')}
        />
      </AdjustmentGroup>
      <AdjustmentGroup
        title="Detail"
        open={wideInspector}
        onReset={() => resetKeys(DETAIL_KEYS, 'Reset detail')}
      >
        <RangeControl
          label="Gamma"
          value={recipe.adjustments.gamma}
          min={0.2}
          max={3}
          step={0.01}
          onChange={(value) => setAdjustment('gamma', value, 'Gamma')}
        />
        <RangeControl
          label="Sharpness"
          value={recipe.adjustments.sharpness}
          min={0}
          max={100}
          onChange={(value) => setAdjustment('sharpness', value, 'Sharpness')}
        />
        <RangeControl
          label="Blur"
          value={recipe.adjustments.blur}
          min={0}
          max={20}
          step={0.1}
          onChange={(value) => setAdjustment('blur', value, 'Blur')}
        />
      </AdjustmentGroup>
      <div className="editor-filter-toggles">
        <label>
          <input
            type="checkbox"
            checked={recipe.adjustments.grayscale}
            onChange={(event) =>
              setAdjustment('grayscale', event.currentTarget.checked, 'Grayscale')
            }
          />
          Grayscale
        </label>
        <label>
          <input
            type="checkbox"
            checked={recipe.adjustments.sepia}
            onChange={(event) => setAdjustment('sepia', event.currentTarget.checked, 'Sepia')}
          />
          Sepia
        </label>
      </div>
    </>
  );
}

function AdjustmentGroup({
  title,
  open,
  onReset,
  children
}: {
  readonly title: string;
  readonly open: boolean;
  readonly onReset: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <details className="editor-adjustment-group" open={open}>
      <summary>
        <strong>{title}</strong>
        <button
          type="button"
          className="icon-button icon-button--small"
          aria-label={`Reset ${title.toLocaleLowerCase()}`}
          onClick={(event) => {
            event.preventDefault();
            onReset();
          }}
        >
          <RotateCcw size={14} />
        </button>
      </summary>
      <div className="editor-adjustment-group__fields">{children}</div>
    </details>
  );
}

function HistoryPanel({
  history,
  onUndo,
  onRedo
}: {
  readonly history: EditorHistoryState;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
}) {
  const entries = [...history.past].reverse();
  return (
    <section className="editor-history-panel">
      <header>
        <HistoryIcon size={18} />
        <span>
          <strong>Transformation history</strong>
          <small>Recipe states only. The source stays untouched.</small>
        </span>
      </header>
      <div className="editor-action-pair">
        <button type="button" disabled={history.past.length === 0} onClick={onUndo}>
          Undo
        </button>
        <button type="button" disabled={history.future.length === 0} onClick={onRedo}>
          Redo
        </button>
      </div>
      <ol>
        {entries.length > 0 ? (
          entries.map((entry, index) => (
            <li key={`${entry.label}-${history.past.length - index}`}>
              <span>{history.past.length - index}</span>
              {entry.label}
            </li>
          ))
        ) : (
          <li className="editor-history-panel__empty">No edits yet</li>
        )}
        <li>
          <span>0</span> Original image
        </li>
      </ol>
    </section>
  );
}

function GeometrySummary({ recipe }: { readonly recipe: EditorRecipe }) {
  return (
    <details className="editor-geometry-summary" open>
      <summary>Geometry</summary>
      <dl>
        <div>
          <dt>Crop</dt>
          <dd>
            {recipe.crop.width} × {recipe.crop.height}
          </dd>
        </div>
        <div>
          <dt>Rotate</dt>
          <dd>{formatNumber(recipe.rotation)}°</dd>
        </div>
        <div>
          <dt>Flip</dt>
          <dd>
            {recipe.flipHorizontal || recipe.flipVertical
              ? [recipe.flipHorizontal ? 'H' : '', recipe.flipVertical ? 'V' : '']
                  .filter(Boolean)
                  .join(' + ')
              : 'none'}
          </dd>
        </div>
        <div>
          <dt>Canvas</dt>
          <dd>
            {recipe.canvas.enabled
              ? `${recipe.canvas.width} × ${recipe.canvas.height}`
              : 'original'}
          </dd>
        </div>
      </dl>
    </details>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange
}: {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly suffix?: string;
  readonly onChange: (value: number) => void;
}) {
  return (
    <label className="editor-range-control">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
      <output>
        {formatNumber(value)}
        {suffix}
      </output>
    </label>
  );
}

function NumberField({
  label,
  value,
  minimum,
  onChange
}: {
  readonly label: string;
  readonly value: number;
  readonly minimum: number;
  readonly onChange: (value: number) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        type="number"
        min={minimum}
        max="32768"
        value={value}
        onChange={(event) =>
          onChange(Math.max(minimum, Math.min(32768, event.currentTarget.valueAsNumber || minimum)))
        }
      />
    </label>
  );
}

function historyOriginalValue(key: keyof EditorRecipe['adjustments']) {
  return key === 'gamma' ? 1 : key === 'grayscale' || key === 'sepia' ? false : 0;
}

function normalizeDegrees(value: number) {
  const normalized = ((value % 360) + 360) % 360;
  return normalized > 180 ? normalized - 360 : normalized;
}

function formatNumber(value: number) {
  return Number.isInteger(value)
    ? `${value}`
    : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
