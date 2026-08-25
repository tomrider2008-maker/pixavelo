import {
  Check,
  Download,
  ExternalLink,
  Link,
  Link2Off,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  WandSparkles,
  X
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNotifications } from '../../components/feedback/Notifications';
import { resolveTransformGeometry } from '../../engine/pipeline/geometry';
import type { CoreImageFormat, ImageCrop, ImageRotation } from '../../types/images';
import { formatBytes } from '../../utils/format';
import { ImageToolInput } from '../tools/ImageToolInput';
import { canPreviewOriginal } from '../tools/previewCapabilities';
import { resolveOutputFormat, useImageTool } from '../tools/useImageTool';
import { CropPreview } from './CropPreview';
import { clampCrop, fitCropToAspect } from './cropMath';
import { clampDimension, resolveResizeDimensions } from './resizeMath';
import {
  ASPECT_RATIOS,
  SOCIAL_PLATFORMS,
  SOCIAL_PRESETS,
  SOCIAL_PRESETS_VERIFIED_ON,
  WEB_PRESETS,
  presetsForPlatform,
  type AspectRatioId,
  type ImageFitMode,
  type ResizeMethod,
  type ResizePresetCategory,
  type SocialPlatform
} from './resizeProfiles';

type OutputChoice = CoreImageFormat | 'keep';

const stageLabels = {
  preparing: 'Preparing locally',
  decoding: 'Decoding image',
  processing: 'Applying resize and fit',
  encoding: 'Encoding output',
  finalizing: 'Verifying output'
} as const;

const RESIZE_METHOD_LABELS: Readonly<Record<ResizeMethod, string>> = {
  exact: 'Exact dimensions',
  width: 'Width only',
  height: 'Height only',
  percentage: 'Percentage',
  'max-width': 'Maximum width',
  'max-height': 'Maximum height',
  'max-bounds': 'Maximum bounds',
  'longest-edge': 'Longest edge',
  'shortest-edge': 'Shortest edge',
  megapixels: 'Megapixel target'
};

const FIT_LABELS: Readonly<Record<ImageFitMode, string>> = {
  contain: 'Contain',
  cover: 'Cover',
  stretch: 'Stretch',
  crop: 'Crop',
  pad: 'Pad'
};

export default function ResizePage() {
  const requestedPreset = readResizePreset();
  const tool = useImageTool();
  const { notify } = useNotifications();
  const [crop, setCrop] = useState<ImageCrop>({ x: 0, y: 0, width: 1, height: 1 });
  const [width, setWidth] = useState(1);
  const [height, setHeight] = useState(1);
  const [percentage, setPercentage] = useState(100);
  const [edge, setEdge] = useState(1920);
  const [megapixels, setMegapixels] = useState(2);
  const [dimensionsLinked, setDimensionsLinked] = useState(true);
  const [preventUpscale, setPreventUpscale] = useState(true);
  const [aspect, setAspect] = useState<AspectRatioId>('original');
  const [customAspectWidth, setCustomAspectWidth] = useState(3);
  const [customAspectHeight, setCustomAspectHeight] = useState(2);
  const [rotation, setRotation] = useState<ImageRotation>(0);
  const [format, setFormat] = useState<OutputChoice>('keep');
  const [quality, setQuality] = useState(88);
  const [background, setBackground] = useState('#ffffff');
  const [fitMode, setFitMode] = useState<ImageFitMode>('contain');
  const [resizeMethod, setResizeMethod] = useState<ResizeMethod>('exact');
  const [presetCategory, setPresetCategory] = useState<ResizePresetCategory>('custom');
  const [platform, setPlatform] = useState<SocialPlatform>('Instagram');
  const [socialPresetId, setSocialPresetId] = useState('instagram-portrait');
  const [webPresetId, setWebPresetId] = useState('web-hero');
  const [activePreset, setActivePreset] = useState('original');
  const sourceWidth = tool.validation?.dimensions?.width ?? 1;
  const sourceHeight = tool.validation?.dimensions?.height ?? 1;
  const outputFormat = resolveOutputFormat(format, tool.validation);
  const previewSourceUrl = canPreviewOriginal(tool.validation?.format) ? tool.sourceUrl : undefined;
  const socialPresets = presetsForPlatform(platform);
  const selectedSocialPreset =
    SOCIAL_PRESETS.find((preset) => preset.id === socialPresetId) ?? socialPresets[0];
  const selectedWebPreset =
    WEB_PRESETS.find((preset) => preset.id === webPresetId) ?? WEB_PRESETS[0];

  const initializeTransform = (nextSourceWidth: number, nextSourceHeight: number) => {
    const nextCrop = { x: 0, y: 0, width: nextSourceWidth, height: nextSourceHeight };
    const presetWidth =
      requestedPreset === '1920' ? Math.min(1920, nextSourceWidth) : nextSourceWidth;
    setCrop(nextCrop);
    setWidth(presetWidth);
    setHeight(Math.max(1, Math.round((nextSourceHeight / nextSourceWidth) * presetWidth)));
    setPercentage(100);
    setEdge(Math.min(1920, Math.max(nextSourceWidth, nextSourceHeight)));
    setMegapixels(Math.round((nextSourceWidth * nextSourceHeight) / 100_000) / 10);
    setDimensionsLinked(true);
    setPreventUpscale(true);
    setAspect('original');
    setRotation(0);
    setFormat('keep');
    setQuality(88);
    setFitMode('contain');
    setResizeMethod(requestedPreset === '1920' ? 'width' : 'exact');
    setPresetCategory('custom');
    setActivePreset(requestedPreset ?? 'original');
  };

  const chooseFile = async (file: File | undefined) => {
    const report = await tool.chooseFile(file);
    if (report?.supportedByConverter && report.dimensions) {
      initializeTransform(report.dimensions.width, report.dimensions.height);
    }
  };

  const requestedDimensions = useMemo(
    () =>
      resolveResizeDimensions(crop.width, crop.height, {
        method: resizeMethod,
        width,
        height,
        percentage,
        edge,
        megapixels
      }),
    [crop.height, crop.width, edge, height, megapixels, percentage, resizeMethod, width]
  );

  const geometry = useMemo(
    () =>
      resolveTransformGeometry(sourceWidth, sourceHeight, {
        crop,
        width: requestedDimensions.width,
        height: requestedDimensions.height,
        fitMode,
        preventUpscale,
        rotation
      }),
    [
      crop,
      fitMode,
      preventUpscale,
      requestedDimensions.height,
      requestedDimensions.width,
      rotation,
      sourceHeight,
      sourceWidth
    ]
  );

  const markCustom = () => {
    tool.discardOutput();
    setPresetCategory('custom');
    setActivePreset('custom');
  };

  const setManualCrop = (nextCrop: ImageCrop) => {
    const normalized = clampCrop(nextCrop, sourceWidth, sourceHeight);
    markCustom();
    setCrop(normalized);
    setFitMode('crop');
    setAspect('custom');
    setCustomAspectWidth(normalized.width);
    setCustomAspectHeight(normalized.height);
    if (dimensionsLinked) {
      setHeight(Math.max(1, Math.round((normalized.height / normalized.width) * width)));
    }
  };

  const applyOriginal = () => {
    markCustom();
    setCrop({ x: 0, y: 0, width: sourceWidth, height: sourceHeight });
    setWidth(sourceWidth);
    setHeight(sourceHeight);
    setResizeMethod('exact');
    setFitMode('contain');
    setAspect('original');
    setActivePreset('original');
  };

  const applyWidePreset = (targetWidth: number) => {
    markCustom();
    const nextWidth = Math.min(targetWidth, sourceWidth);
    setCrop({ x: 0, y: 0, width: sourceWidth, height: sourceHeight });
    setWidth(nextWidth);
    setHeight(Math.max(1, Math.round((sourceHeight / sourceWidth) * nextWidth)));
    setResizeMethod('width');
    setFitMode('contain');
    setAspect('original');
    setActivePreset(`${targetWidth}`);
  };

  const applyDimensionPreset = (preset: {
    readonly id: string;
    readonly width: number;
    readonly height: number;
    readonly fit: ImageFitMode;
  }) => {
    tool.discardOutput();
    setWidth(preset.width);
    setHeight(preset.height);
    setResizeMethod('exact');
    setFitMode(preset.fit);
    setActivePreset(preset.id);
    const ratio = preset.width / preset.height;
    const matchedAspect = findAspectId(ratio);
    setAspect(matchedAspect);
    if (matchedAspect === 'custom') {
      setCustomAspectWidth(preset.width);
      setCustomAspectHeight(preset.height);
    }
    setCrop(
      preset.fit === 'cover' || preset.fit === 'crop'
        ? fitCropToAspect(sourceWidth, sourceHeight, ratio)
        : { x: 0, y: 0, width: sourceWidth, height: sourceHeight }
    );
  };

  const selectSocialPreset = (presetId: string) => {
    const preset = SOCIAL_PRESETS.find((candidate) => candidate.id === presetId);
    if (!preset) return;
    setPresetCategory('social');
    setPlatform(preset.platform);
    setSocialPresetId(preset.id);
    applyDimensionPreset(preset);
  };

  const selectWebPreset = (presetId: string) => {
    const preset = WEB_PRESETS.find((candidate) => candidate.id === presetId);
    if (!preset) return;
    setPresetCategory('web');
    setWebPresetId(preset.id);
    applyDimensionPreset(preset);
  };

  const changeAspect = (
    nextAspect: AspectRatioId,
    nextCustomWidth = customAspectWidth,
    nextCustomHeight = customAspectHeight
  ) => {
    markCustom();
    setAspect(nextAspect);
    const ratio =
      nextAspect === 'original'
        ? sourceWidth / sourceHeight
        : nextAspect === 'custom'
          ? nextCustomWidth / nextCustomHeight
          : ASPECT_RATIOS[nextAspect];
    if (!Number.isFinite(ratio) || ratio <= 0) return;
    if (fitMode === 'cover' || fitMode === 'crop') {
      setCrop(fitCropToAspect(sourceWidth, sourceHeight, ratio));
    }
    if (dimensionsLinked && resizeMethod === 'exact') {
      setHeight(Math.max(1, Math.round(width / ratio)));
    }
  };

  const changeWidth = (nextWidth: number) => {
    const safeWidth = clampDimension(nextWidth);
    markCustom();
    setWidth(safeWidth);
    if (dimensionsLinked) {
      setHeight(Math.max(1, Math.round((crop.height / crop.width) * safeWidth)));
    }
  };

  const changeHeight = (nextHeight: number) => {
    const safeHeight = clampDimension(nextHeight);
    markCustom();
    setHeight(safeHeight);
    if (dimensionsLinked) {
      setWidth(Math.max(1, Math.round((crop.width / crop.height) * safeHeight)));
    }
  };

  const reset = () => {
    tool.discardOutput();
    initializeTransform(sourceWidth, sourceHeight);
  };

  const applyTransform = async () => {
    const result = await tool.process(
      {
        outputFormat,
        crop,
        width: requestedDimensions.width,
        height: requestedDimensions.height,
        fitMode,
        rotation,
        preventUpscale,
        ...(outputFormat === 'png' ? {} : { quality: quality / 100 }),
        ...(outputFormat === 'jpeg' || fitMode === 'pad' ? { background } : {})
      },
      'resized'
    );
    if (!result) return;
    notify({
      title: 'Resize complete',
      message: `${result.width} × ${result.height} ${result.mime.replace('image/', '').toUpperCase()} verified locally.`,
      tone: 'success'
    });
  };

  const canProcess = Boolean(tool.validation?.supportedByConverter) && tool.status !== 'processing';

  return (
    <section className="converter-page tool-page resize-page phase5-resize-page">
      <header className="workspace-header">
        <div>
          <h1>Resize &amp; transform</h1>
          <p>Create exact, bounded, social, and web-ready dimensions locally.</p>
        </div>
      </header>

      {!tool.file || !tool.validation?.dimensions || !tool.sourceUrl ? (
        <ImageToolInput
          file={tool.file}
          validation={tool.validation}
          sourceUrl={tool.sourceUrl}
          status={tool.status}
          error={tool.error}
          actionLabel="Choose an image to resize"
          onChoose={(file) => void chooseFile(file)}
          onRemove={tool.removeFile}
        />
      ) : (
        <div className="phase5-resize-workspace">
          <div className="phase5-resize-main">
            <ImageToolInput
              file={tool.file}
              validation={tool.validation}
              sourceUrl={tool.sourceUrl}
              status={tool.status}
              error={tool.error}
              actionLabel="Choose an image to resize"
              onChoose={(file) => void chooseFile(file)}
              onRemove={tool.removeFile}
            />

            <section className="preset-browser" aria-label="Resize presets">
              <div className="preset-category-tabs" role="tablist" aria-label="Preset category">
                {(['custom', 'social', 'web'] as const).map((category) => (
                  <button
                    key={category}
                    type="button"
                    role="tab"
                    aria-selected={presetCategory === category}
                    onClick={() => setPresetCategory(category)}
                  >
                    {capitalize(category)}
                  </button>
                ))}
              </div>

              {presetCategory === 'social' ? (
                <div className="preset-selector-grid">
                  <label className="control-field">
                    <span>Platform</span>
                    <select
                      value={platform}
                      onChange={(event) => {
                        const nextPlatform = event.currentTarget.value as SocialPlatform;
                        const firstPreset = presetsForPlatform(nextPlatform)[0];
                        setPlatform(nextPlatform);
                        if (firstPreset) selectSocialPreset(firstPreset.id);
                      }}
                    >
                      {SOCIAL_PLATFORMS.map((entry) => (
                        <option key={entry}>{entry}</option>
                      ))}
                    </select>
                  </label>
                  <label className="control-field">
                    <span>Type</span>
                    <select
                      value={selectedSocialPreset?.id}
                      onChange={(event) => selectSocialPreset(event.currentTarget.value)}
                    >
                      {socialPresets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.label} · {preset.width} × {preset.height}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedSocialPreset ? (
                    <a
                      className="preset-source-link"
                      href={selectedSocialPreset.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {selectedSocialPreset.guidance === 'official'
                        ? 'Official guidance'
                        : 'Common canvas'}
                      <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
              ) : presetCategory === 'web' ? (
                <div className="preset-selector-grid preset-selector-grid--web">
                  <label className="control-field">
                    <span>Web profile</span>
                    <select
                      value={selectedWebPreset.id}
                      onChange={(event) => selectWebPreset(event.currentTarget.value)}
                    >
                      {WEB_PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.label} · {preset.width} × {preset.height}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : (
                <p className="preset-custom-note">
                  Choose a method below or start from a recent preset.
                </p>
              )}

              <div className="phase5-preset-rail">
                <PresetButton
                  label="Original"
                  detail={`${sourceWidth} × ${sourceHeight}`}
                  selected={activePreset === 'original'}
                  onClick={applyOriginal}
                />
                <PresetButton
                  label="1920 wide"
                  detail={`${Math.min(1920, sourceWidth)} × ${Math.round((sourceHeight / sourceWidth) * Math.min(1920, sourceWidth))}`}
                  selected={activePreset === '1920'}
                  onClick={() => applyWidePreset(1920)}
                />
                <PresetButton
                  label="Instagram portrait"
                  detail="1080 × 1350"
                  selected={activePreset === 'instagram-portrait'}
                  onClick={() => selectSocialPreset('instagram-portrait')}
                />
                <PresetButton
                  label="YouTube thumbnail"
                  detail="3840 × 2160"
                  selected={activePreset === 'youtube-thumbnail'}
                  onClick={() => selectSocialPreset('youtube-thumbnail')}
                />
              </div>
              <small className="preset-guidance-date">
                Platform guidance reviewed {SOCIAL_PRESETS_VERIFIED_ON}. Requirements may change.
              </small>
            </section>

            <div className="resize-canvas-column phase5-resize-canvas-column">
              <CropPreview
                {...(previewSourceUrl ? { sourceUrl: previewSourceUrl } : {})}
                {...(tool.output ? { outputUrl: tool.output.url } : {})}
                sourceWidth={sourceWidth}
                sourceHeight={sourceHeight}
                crop={crop}
                onChange={setManualCrop}
                onManualCrop={() => {
                  markCustom();
                  setFitMode('crop');
                }}
              />
              <div className="resize-canvas-meta">
                <span>
                  {tool.output
                    ? 'Verified output'
                    : `${FIT_LABELS[fitMode]} fit · drag crop handles when needed`}
                </span>
                <strong>
                  {geometry.outputWidth} × {geometry.outputHeight}
                </strong>
              </div>
            </div>
          </div>

          <aside
            className="transform-inspector phase5-transform-inspector"
            aria-label="Resize settings"
          >
            <fieldset>
              <legend>Resize method</legend>
              <label className="control-field">
                <span>Method</span>
                <select
                  value={resizeMethod}
                  onChange={(event) => {
                    markCustom();
                    setResizeMethod(event.currentTarget.value as ResizeMethod);
                  }}
                >
                  {(Object.entries(RESIZE_METHOD_LABELS) as readonly [ResizeMethod, string][]).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>
              </label>
              <ResizeMethodFields
                method={resizeMethod}
                width={width}
                height={height}
                percentage={percentage}
                edge={edge}
                megapixels={megapixels}
                linked={dimensionsLinked}
                onWidth={changeWidth}
                onHeight={changeHeight}
                onPercentage={(value) => {
                  markCustom();
                  setPercentage(Math.max(1, Math.min(800, value)));
                }}
                onEdge={(value) => {
                  markCustom();
                  setEdge(clampDimension(value));
                }}
                onMegapixels={(value) => {
                  markCustom();
                  setMegapixels(Math.max(0.01, Math.min(120, value)));
                }}
                onToggleLink={() => setDimensionsLinked((current) => !current)}
              />
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={preventUpscale}
                  onChange={(event) => {
                    tool.discardOutput();
                    setPreventUpscale(event.currentTarget.checked);
                  }}
                />
                Prevent upscaling
              </label>
            </fieldset>

            <fieldset>
              <legend>Fit</legend>
              <div className="fit-mode-options">
                {(Object.entries(FIT_LABELS) as readonly [ImageFitMode, string][]).map(
                  ([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={fitMode === value}
                      onClick={() => {
                        markCustom();
                        setFitMode(value);
                      }}
                    >
                      {label}
                    </button>
                  )
                )}
              </div>
              <label className="control-field">
                <span>Aspect ratio</span>
                <select
                  value={aspect}
                  onChange={(event) => changeAspect(event.currentTarget.value as AspectRatioId)}
                >
                  <option value="original">Original</option>
                  {Object.keys(ASPECT_RATIOS).map((ratio) => (
                    <option key={ratio} value={ratio}>
                      {ratio}
                    </option>
                  ))}
                  <option value="custom">Custom</option>
                </select>
              </label>
              {aspect === 'custom' ? (
                <div className="custom-aspect-row">
                  <UnitInput
                    label="Ratio width"
                    value={customAspectWidth}
                    unit=""
                    onChange={(value) => {
                      setCustomAspectWidth(value);
                      changeAspect('custom', value, customAspectHeight);
                    }}
                  />
                  <span>:</span>
                  <UnitInput
                    label="Ratio height"
                    value={customAspectHeight}
                    unit=""
                    onChange={(value) => {
                      setCustomAspectHeight(value);
                      changeAspect('custom', customAspectWidth, value);
                    }}
                  />
                </div>
              ) : null}
            </fieldset>

            <fieldset>
              <legend>Rotate</legend>
              <div className="rotation-options">
                {([0, 90, 180, 270] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={rotation === value}
                    onClick={() => {
                      tool.discardOutput();
                      setRotation(value);
                    }}
                  >
                    <RotateCcw size={14} aria-hidden="true" /> {value}°
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>Output</legend>
              <label className="control-field">
                <span>Format</span>
                <select
                  value={format}
                  onChange={(event) => {
                    tool.discardOutput();
                    setFormat(event.currentTarget.value as OutputChoice);
                  }}
                >
                  <option value="keep">Automatic ({outputFormat.toUpperCase()})</option>
                  <option value="jpeg">JPEG</option>
                  <option value="png">PNG</option>
                  <option value="webp">WebP</option>
                </select>
              </label>
              <label className="range-field resize-quality-field">
                <span>
                  Quality <output>{quality}</output>
                </span>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={quality}
                  disabled={outputFormat === 'png'}
                  onChange={(event) => {
                    tool.discardOutput();
                    setQuality(event.currentTarget.valueAsNumber);
                  }}
                />
              </label>
              <label className="control-field background-field">
                <span>Background {fitMode === 'pad' ? '' : '(Pad only)'}</span>
                <input
                  type="color"
                  value={background}
                  disabled={fitMode !== 'pad' && outputFormat !== 'jpeg'}
                  onChange={(event) => {
                    tool.discardOutput();
                    setBackground(event.currentTarget.value);
                  }}
                />
              </label>
              <dl className="output-inline-summary">
                <div>
                  <dt>Output</dt>
                  <dd>
                    {geometry.outputWidth} × {geometry.outputHeight}
                  </dd>
                </div>
                <div>
                  <dt>Megapixels</dt>
                  <dd>
                    {((geometry.outputWidth * geometry.outputHeight) / 1_000_000).toFixed(2)} MP
                  </dd>
                </div>
                <div>
                  <dt>Format</dt>
                  <dd>{outputFormat.toUpperCase()}</dd>
                </div>
                {tool.output ? (
                  <div>
                    <dt>Size</dt>
                    <dd>{formatBytes(tool.output.size)}</dd>
                  </div>
                ) : null}
              </dl>
            </fieldset>

            {tool.status === 'processing' ? (
              <div className="processing-line" role="status" aria-live="polite">
                <LoaderCircle className="spin" size={17} aria-hidden="true" />
                {tool.stage ? stageLabels[tool.stage] : 'Processing'}
              </div>
            ) : null}

            {tool.output ? (
              <>
                <div className="verified-line">
                  <Check size={15} aria-hidden="true" /> Output decoded and verified
                </div>
                <a
                  className="button button--primary"
                  href={tool.output.url}
                  download={tool.output.filename}
                >
                  <Download size={17} aria-hidden="true" /> Download resized image
                </a>
              </>
            ) : (
              <button
                className="button button--primary"
                type="button"
                disabled={!canProcess}
                onClick={() => void applyTransform()}
              >
                <WandSparkles size={17} aria-hidden="true" /> Apply resize
              </button>
            )}

            {tool.status === 'processing' ? (
              <button className="button button--secondary" type="button" onClick={tool.cancel}>
                <X size={17} aria-hidden="true" /> Cancel
              </button>
            ) : (
              <button className="button button--secondary" type="button" onClick={reset}>
                <RotateCcw size={17} aria-hidden="true" /> Reset
              </button>
            )}

            <div className="tool-summary__privacy tool-summary__privacy--compact">
              <ShieldCheck size={17} aria-hidden="true" />
              <span>
                <strong>Processed entirely on this device</strong>
                <small>No upload or remote API.</small>
              </span>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

function ResizeMethodFields({
  method,
  width,
  height,
  percentage,
  edge,
  megapixels,
  linked,
  onWidth,
  onHeight,
  onPercentage,
  onEdge,
  onMegapixels,
  onToggleLink
}: {
  readonly method: ResizeMethod;
  readonly width: number;
  readonly height: number;
  readonly percentage: number;
  readonly edge: number;
  readonly megapixels: number;
  readonly linked: boolean;
  readonly onWidth: (value: number) => void;
  readonly onHeight: (value: number) => void;
  readonly onPercentage: (value: number) => void;
  readonly onEdge: (value: number) => void;
  readonly onMegapixels: (value: number) => void;
  readonly onToggleLink: () => void;
}) {
  if (method === 'percentage')
    return <UnitInput label="Percentage" value={percentage} unit="%" onChange={onPercentage} />;
  if (method === 'longest-edge' || method === 'shortest-edge')
    return (
      <UnitInput
        label={method === 'longest-edge' ? 'Longest edge' : 'Shortest edge'}
        value={edge}
        onChange={onEdge}
      />
    );
  if (method === 'megapixels')
    return (
      <DecimalInput
        label="Target megapixels"
        value={megapixels}
        unit="MP"
        onChange={onMegapixels}
      />
    );
  if (method === 'width' || method === 'max-width')
    return <UnitInput label="Width" value={width} onChange={onWidth} />;
  if (method === 'height' || method === 'max-height')
    return <UnitInput label="Height" value={height} onChange={onHeight} />;
  return (
    <div className="dimension-row">
      <UnitInput label="Width" value={width} onChange={onWidth} />
      <button
        className="dimension-link"
        type="button"
        aria-pressed={linked}
        aria-label={linked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
        onClick={onToggleLink}
      >
        {linked ? <Link size={18} /> : <Link2Off size={18} />}
      </button>
      <UnitInput label="Height" value={height} onChange={onHeight} />
    </div>
  );
}

function PresetButton({
  label,
  detail,
  selected,
  onClick
}: {
  readonly label: string;
  readonly detail: string;
  readonly selected: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={selected ? 'selected' : ''}
      aria-pressed={selected}
      onClick={onClick}
    >
      <strong>{label}</strong>
      <small>{detail}</small>
    </button>
  );
}

function UnitInput({
  label,
  value,
  unit = 'px',
  onChange
}: {
  readonly label: string;
  readonly value: number;
  readonly unit?: string;
  readonly onChange: (value: number) => void;
}) {
  return (
    <label className="unit-field">
      <span>{label}</span>
      <span className="number-with-unit">
        <input
          type="number"
          min="0"
          max="32768"
          value={value}
          onChange={(event) => onChange(event.currentTarget.valueAsNumber || 0)}
        />
        {unit ? <span>{unit}</span> : null}
      </span>
    </label>
  );
}

function DecimalInput({
  label,
  value,
  unit,
  onChange
}: {
  readonly label: string;
  readonly value: number;
  readonly unit: string;
  readonly onChange: (value: number) => void;
}) {
  return (
    <label className="unit-field">
      <span>{label}</span>
      <span className="number-with-unit">
        <input
          type="number"
          min="0.01"
          max="120"
          step="0.1"
          value={value}
          onChange={(event) => onChange(event.currentTarget.valueAsNumber || 0.01)}
        />
        <span>{unit}</span>
      </span>
    </label>
  );
}

function findAspectId(ratio: number): AspectRatioId {
  const match = Object.entries(ASPECT_RATIOS).find(([, value]) => Math.abs(value - ratio) < 0.01);
  return (match?.[0] as AspectRatioId | undefined) ?? 'custom';
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function readResizePreset(): '1920' | undefined {
  return new URLSearchParams(window.location.search).get('preset') === '1920' ? '1920' : undefined;
}
