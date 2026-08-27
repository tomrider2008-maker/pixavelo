import {
  BarChart3,
  Check,
  FlipHorizontal2,
  FlipVertical2,
  History as HistoryIcon,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { useState } from 'react';
import { DEFAULT_IMAGE_ADJUSTMENTS } from '../../engine/pipeline/imageAdjustments';
import { fitCropToAspect } from '../resize/cropMath';
import type { EditorHistoryState } from './history';
import type { EditorImageAnalysis } from './imageAnalysis';
import { activeEditorLook, EDITOR_LOOKS } from './looks';
import { PixelEditInspector } from './PixelEditInspector';
import type { EditorCutoutToolState, EditorRemoveToolState } from './pixelToolState';
import type { EditorExportSettings, EditorRecipe, EditorTool } from './types';

interface EditorInspectorProps {
  readonly activeTool: EditorTool;
  readonly panel: 'adjust' | 'history';
  readonly history: EditorHistoryState;
  readonly analysis: EditorImageAnalysis | undefined;
  readonly output: EditorExportSettings;
  readonly outputWidth: number;
  readonly outputHeight: number;
  readonly removeTool: EditorRemoveToolState;
  readonly cutoutTool: EditorCutoutToolState;
  readonly pendingPixelCount: number;
  readonly pixelSettingsDirty: boolean;
  readonly pixelEditingSupported: boolean;
  readonly onPanel: (panel: 'adjust' | 'history') => void;
  readonly onApply: (recipe: EditorRecipe, label: string, group?: string) => void;
  readonly onOutput: (output: EditorExportSettings) => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onResetTool: () => void;
  readonly onRestoreOriginal: () => void;
  readonly onRemoveTool: (state: EditorRemoveToolState) => void;
  readonly onCutoutTool: (state: EditorCutoutToolState) => void;
  readonly onUndoPendingPixel: () => void;
  readonly onClearPendingPixel: () => void;
  readonly onApplyPendingPixel: () => void;
}

const LIGHT_KEYS = ['exposure', 'brightness', 'contrast', 'highlights', 'shadows'] as const;
const COLOR_KEYS = ['saturation', 'temperature', 'tint'] as const;
const DETAIL_KEYS = ['gamma', 'sharpness', 'blur'] as const;

export function EditorInspector({
  activeTool,
  panel,
  history,
  analysis,
  output,
  outputWidth,
  outputHeight,
  removeTool,
  cutoutTool,
  pendingPixelCount,
  pixelSettingsDirty,
  pixelEditingSupported,
  onPanel,
  onApply,
  onOutput,
  onUndo,
  onRedo,
  onResetTool,
  onRestoreOriginal,
  onRemoveTool,
  onCutoutTool,
  onUndoPendingPixel,
  onClearPendingPixel,
  onApplyPendingPixel
}: EditorInspectorProps) {
  const recipe = history.present;
  const pixelTool = activeTool === 'remove' || activeTool === 'cutout';
  const [desktopInspector] = useState(() => window.innerWidth > 860);

  return (
    <aside className="editor-inspector" aria-label="Editor controls">
      <div className="editor-inspector__tabs" role="tablist" aria-label="Editor inspector">
        <button
          type="button"
          role="tab"
          aria-selected={panel === 'adjust'}
          onClick={() => onPanel('adjust')}
        >
          {pixelTool ? 'Tool' : 'Adjust'}
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
        ) : (
          <>
            {pixelTool ? (
              <PixelEditInspector
                activeTool={activeTool}
                remove={removeTool}
                cutout={cutoutTool}
                pendingCount={pendingPixelCount}
                dirty={pixelSettingsDirty}
                supported={pixelEditingSupported}
                showApply={!desktopInspector}
                onRemove={onRemoveTool}
                onCutout={onCutoutTool}
                onUndoPending={onUndoPendingPixel}
                onClearPending={onClearPendingPixel}
                onApplyPending={onApplyPendingPixel}
              />
            ) : (
              <StudioIntelligence recipe={recipe} analysis={analysis} onApply={onApply} />
            )}
            {pixelTool || activeTool === 'looks' ? null : activeTool === 'crop' ? (
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
          </>
        )}

        {panel === 'adjust' ? (
          <>
            <fieldset className="editor-output-controls">
              <legend>Export</legend>
              <div className="editor-export-summary">
                <strong>
                  {outputWidth} × {outputHeight}
                </strong>
                <span>
                  <ShieldCheck size={13} /> Metadata removed
                </span>
              </div>
              <div className="editor-format-options" aria-label="Export format">
                {(['webp', 'jpeg', 'png'] as const).map((format) => (
                  <button
                    key={format}
                    type="button"
                    aria-pressed={output.format === format}
                    onClick={() => onOutput({ ...output, format })}
                  >
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>
              <label className="sr-only">
                Format
                <select
                  aria-label="Format"
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
        {pixelTool && desktopInspector && panel === 'adjust' ? (
          <button
            className="button button--primary"
            style={{ gridColumn: '1 / -1' }}
            type="button"
            disabled={!pixelEditingSupported || (pendingPixelCount === 0 && !pixelSettingsDirty)}
            onClick={onApplyPendingPixel}
          >
            <Check size={16} /> Apply {activeTool === 'cutout' ? 'cutout' : 'removal'}
          </button>
        ) : null}
        <button className="button button--secondary" type="button" onClick={onResetTool}>
          Reset tool
        </button>
        <button className="button button--secondary" type="button" onClick={onRestoreOriginal}>
          Restore original
        </button>
      </footer>
    </aside>
  );
}

function StudioIntelligence({
  recipe,
  analysis,
  onApply
}: {
  readonly recipe: EditorRecipe;
  readonly analysis: EditorImageAnalysis | undefined;
  readonly onApply: EditorInspectorProps['onApply'];
}) {
  const activeLook = activeEditorLook(recipe.adjustments);
  const applyLook = (look: (typeof EDITOR_LOOKS)[number]) =>
    onApply({ ...recipe, adjustments: look.adjustments }, `${look.label} look`);
  const applyAutoTone = () => {
    if (!analysis) return;
    onApply(
      {
        ...recipe,
        adjustments: {
          ...DEFAULT_IMAGE_ADJUSTMENTS,
          ...analysis.suggestedAdjustments,
          temperature: recipe.adjustments.temperature,
          tint: recipe.adjustments.tint
        }
      },
      'Auto tone'
    );
  };

  return (
    <section className="editor-intelligence" aria-label="Local image analysis">
      <header>
        <span>
          <BarChart3 size={15} /> Histogram
        </span>
        <small>{analysis ? 'Live local analysis' : 'Analyzing locally…'}</small>
      </header>
      <Histogram analysis={analysis} />
      <div className="editor-looks-heading">
        <strong>Quick looks</strong>
        <small>One-click · non-destructive</small>
      </div>
      <div className="editor-looks" aria-label="Quick looks">
        {EDITOR_LOOKS.map((look) => (
          <button
            key={look.id}
            className={`editor-look editor-look--${look.id}`}
            type="button"
            aria-pressed={activeLook?.id === look.id}
            title={look.description}
            onClick={() => applyLook(look)}
          >
            <span aria-hidden="true">
              {activeLook?.id === look.id ? <Check size={12} /> : null}
            </span>
            <small>{look.label}</small>
          </button>
        ))}
      </div>
      <button
        className="editor-auto-tone"
        type="button"
        disabled={!analysis}
        onClick={applyAutoTone}
      >
        <Sparkles size={15} />
        <strong>Auto Tone</strong>
        <span>Analyzed on this device</span>
      </button>
    </section>
  );
}

function Histogram({ analysis }: { readonly analysis: EditorImageAnalysis | undefined }) {
  const path = (values: readonly number[] | undefined) => {
    if (!values) return '';
    const points = values
      .map((value, index) => `${(index / (values.length - 1)) * 100},${42 - value * 38}`)
      .join(' L ');
    return `M 0,42 L ${points} L 100,42 Z`;
  };
  return (
    <div className={`editor-histogram${analysis ? '' : ' editor-histogram--loading'}`}>
      <svg
        viewBox="0 0 100 44"
        preserveAspectRatio="none"
        role="img"
        aria-label="RGB luminance histogram"
      >
        <path className="editor-histogram__luma" d={path(analysis?.luminance)} />
        <path className="editor-histogram__red" d={path(analysis?.red)} />
        <path className="editor-histogram__green" d={path(analysis?.green)} />
        <path className="editor-histogram__blue" d={path(analysis?.blue)} />
      </svg>
      {analysis ? (
        <span>
          <small>Shadows {Math.round(analysis.shadowPercent * 100)}%</small>
          <small>Mid {Math.round(analysis.meanLuminance * 100)}%</small>
          <small>Highlights {Math.round(analysis.highlightPercent * 100)}%</small>
        </span>
      ) : null}
    </div>
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
        <button type="button" onClick={() => applyAspect(3 / 2)}>
          3:2
        </button>
        <button type="button" onClick={() => applyAspect(4 / 5)}>
          4:5
        </button>
        <button type="button" onClick={() => applyAspect(9 / 16)}>
          9:16
        </button>
        <button type="button" onClick={() => applyAspect(21 / 9)}>
          21:9
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
  const setCanvas = (width: number, height: number, label: string) =>
    onApply({ ...recipe, canvas: { ...recipe.canvas, enabled: true, width, height } }, label);
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
      <div className="editor-canvas-presets" aria-label="Canvas presets">
        <button type="button" onClick={() => setCanvas(1080, 1080, 'Square canvas')}>
          Square<small>1080 × 1080</small>
        </button>
        <button type="button" onClick={() => setCanvas(1080, 1350, 'Portrait canvas')}>
          Portrait<small>1080 × 1350</small>
        </button>
        <button type="button" onClick={() => setCanvas(1920, 1080, 'HD canvas')}>
          HD<small>1920 × 1080</small>
        </button>
        <button type="button" onClick={() => setCanvas(3840, 2160, '4K canvas')}>
          4K<small>3840 × 2160</small>
        </button>
      </div>
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
