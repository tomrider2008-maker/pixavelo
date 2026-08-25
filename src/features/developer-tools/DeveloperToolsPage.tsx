import { Download, LoaderCircle, RotateCcw } from 'lucide-react';
import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImageToolInput } from '../tools/ImageToolInput';
import { useImageTool } from '../tools/useImageTool';
import { CalculatorsUtility } from './CalculatorsUtility';
import { Base64Utility, FrameUtility, HashUtility } from './FileUtilities';
import { PresetUtility } from './PresetUtility';
import { SpriteSheetUtility } from './SpriteSheetUtility';
import type {
  ProfessionalUtilityMode,
  SpriteSheetSettings,
  UtilityPresetRecord,
  WatermarkUtilitySettings
} from './types';
import { UtilityRail } from './UtilityRail';
import { WatermarkUtility } from './WatermarkUtility';

const DEFAULT_WATERMARK: WatermarkUtilitySettings = {
  text: '© Northstar Studio',
  position: 'bottom-right',
  opacity: 0.72,
  sizePercent: 0.04,
  color: '#ffffff',
  outputFormat: 'jpeg',
  quality: 0.9
};

const DEFAULT_SPRITE: SpriteSheetSettings = {
  cellWidth: 128,
  cellHeight: 128,
  columns: 4,
  gap: 0,
  background: 'transparent'
};

const fileModes = new Set<ProfessionalUtilityMode>(['watermark', 'frames', 'base64', 'hash']);
const primaryLabels: Record<ProfessionalUtilityMode, string> = {
  watermark: 'Export result',
  frames: 'Extract frames',
  base64: 'Encode Base64',
  hash: 'Calculate hash',
  sprite: 'Build sprite sheet',
  calculators: 'Copy result',
  presets: 'Save preset'
};

export default function DeveloperToolsPage() {
  const tool = useImageTool();
  const [mode, setMode] = useState<ProfessionalUtilityMode>('watermark');
  const [watermark, setWatermark] = useState(DEFAULT_WATERMARK);
  const [sprite, setSprite] = useState(DEFAULT_SPRITE);
  const [utilityReady, setUtilityReady] = useState(true);
  const [utilityKey, setUtilityKey] = useState(0);

  const reset = useCallback(() => {
    tool.removeFile();
    setMode('watermark');
    setWatermark(DEFAULT_WATERMARK);
    setSprite(DEFAULT_SPRITE);
    setUtilityReady(true);
    setUtilityKey((current) => current + 1);
  }, [tool]);

  const changeMode = (next: ProfessionalUtilityMode) => {
    tool.discardOutput();
    setMode(next);
    setUtilityReady(next === 'sprite' ? false : true);
  };

  const exportWatermark = () => {
    void tool.process(
      {
        outputFormat: watermark.outputFormat,
        quality: watermark.quality,
        watermark: {
          text: watermark.text,
          position: watermark.position,
          opacity: watermark.opacity,
          sizePercent: watermark.sizePercent,
          color: watermark.color
        }
      },
      'watermarked'
    );
  };

  const applyPreset = (preset: UtilityPresetRecord) => {
    setWatermark(preset.watermark);
    setSprite(preset.sprite);
    setMode('watermark');
    setUtilityReady(true);
    tool.discardOutput();
  };

  const fileRequired = fileModes.has(mode);
  const canRun = fileRequired
    ? Boolean(tool.file && tool.validation?.supportedByConverter && tool.status !== 'processing')
    : utilityReady;
  const triggerPrimary = () =>
    document.querySelector<HTMLElement>('[data-utility-primary]')?.click();

  return (
    <section className="developer-tools-workspace" aria-labelledby="developer-tools-title">
      <header className="developer-tools-heading">
        <div>
          <h1 id="developer-tools-title">Professional Utilities</h1>
          <p>Watermark, extract, encode, verify and package image assets locally.</p>
        </div>
        <div className="developer-tools-heading__actions">
          <button className="button button--secondary" type="button" onClick={reset}>
            <RotateCcw size={17} /> Reset
          </button>
          <button
            className="button button--primary"
            type="button"
            disabled={!canRun}
            onClick={triggerPrimary}
          >
            {tool.status === 'processing' ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Download size={17} />
            )}
            {primaryLabels[mode]}
          </button>
        </div>
      </header>

      {fileRequired ? (
        <ImageToolInput
          file={tool.file}
          validation={tool.validation}
          sourceUrl={tool.sourceUrl}
          status={tool.status}
          error={tool.error}
          actionLabel={`Choose an image for ${primaryLabels[mode].toLowerCase()}`}
          onChoose={(file) => void tool.chooseFile(file)}
          onRemove={tool.removeFile}
        />
      ) : null}

      <UtilityRail mode={mode} onChange={changeMode} />

      <div className="utility-surface" role="tabpanel" key={`${mode}-${utilityKey}`}>
        {mode === 'watermark' ? (
          <>
            <WatermarkUtility
              tool={tool}
              settings={watermark}
              setSettings={setWatermark}
              onExport={exportWatermark}
            />
            <LocalUtilityTable />
          </>
        ) : null}
        {mode === 'frames' ? <FrameUtility file={tool.file} validation={tool.validation} /> : null}
        {mode === 'base64' ? <Base64Utility file={tool.file} /> : null}
        {mode === 'hash' ? <HashUtility file={tool.file} /> : null}
        {mode === 'sprite' ? (
          <SpriteSheetUtility
            settings={sprite}
            setSettings={setSprite}
            onReadyChange={setUtilityReady}
          />
        ) : null}
        {mode === 'calculators' ? <CalculatorsUtility onReadyChange={setUtilityReady} /> : null}
        {mode === 'presets' ? (
          <PresetUtility
            watermark={watermark}
            sprite={sprite}
            onApply={applyPreset}
            onReadyChange={setUtilityReady}
          />
        ) : null}
      </div>

      {createPortal(
        <button
          className="button button--primary developer-tools-mobile-action"
          type="button"
          disabled={!canRun}
          onClick={triggerPrimary}
        >
          {tool.status === 'processing' ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <Download size={17} />
          )}
          {primaryLabels[mode]}
        </button>,
        document.body
      )}
    </section>
  );
}

const utilityCapabilities = [
  ['Watermark', 'Add a configurable text watermark', 'Images', 'Watermarked images'],
  ['Frames', 'Extract frames from animated images', 'Images', 'Frame ZIP'],
  ['Base64', 'Encode or decode Base64 data', 'Images', 'Base64 or decoded file'],
  ['Hash', 'Generate a SHA-256 checksum', 'Files', 'SHA-256 hash'],
  ['Sprite sheet', 'Build a PNG sheet from multiple images', 'Images', 'PNG and JSON map'],
  ['Calculators', 'Calculate dimensions, ratios and storage', 'Values', 'Calculated results'],
  ['Presets', 'Import or export utility settings', 'Configurations', 'Preset JSON']
] as const;

function LocalUtilityTable() {
  return (
    <section className="local-utilities-table" aria-labelledby="local-utilities-title">
      <header>
        <h2 id="local-utilities-title">Local utilities</h2>
        <p>Every mode operates on this device. No selected file is uploaded or transmitted.</p>
      </header>
      <div
        className="local-utilities-table__scroll"
        role="region"
        aria-label="Utility capability table"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Utility</th>
              <th>Purpose</th>
              <th>Inputs</th>
              <th>Outputs</th>
            </tr>
          </thead>
          <tbody>
            {utilityCapabilities.map(([utility, purpose, input, output]) => (
              <tr key={utility}>
                <th scope="row">{utility}</th>
                <td>{purpose}</td>
                <td>{input}</td>
                <td>{output}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
