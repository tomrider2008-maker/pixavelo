import {
  Columns2,
  Crop,
  Download,
  FlipHorizontal2,
  Frame,
  ImagePlus,
  LoaderCircle,
  Redo2,
  RotateCw,
  Sparkles,
  SlidersHorizontal,
  Undo2
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { useNotifications } from '../../components/feedback/Notifications';
import { toAppError } from '../../engine/errors/AppError';
import { resolveTransformGeometry } from '../../engine/pipeline/geometry';
import { formatBytes, formatReduction } from '../../utils/format';
import { ImageToolInput } from '../tools/ImageToolInput';
import { useImageTool } from '../tools/useImageTool';
import { decodeEditorSource, type DecodedEditorSource } from './decodeEditorSource';
import { EditorCanvas } from './EditorCanvas';
import { EditorInspector } from './EditorInspector';
import { createEditorHistory, editorHistoryReducer } from './history';
import { analyzeEditorSource, type EditorImageAnalysis } from './imageAnalysis';
import {
  countRecipeEdits,
  createEditorRecipe,
  recipeToProcessingOptions,
  resetToolRecipe
} from './recipe';
import type {
  EditorCompareMode,
  EditorExportSettings,
  EditorRecipe,
  EditorTool,
  EditorZoom
} from './types';

const tools = [
  { id: 'looks', label: 'Looks', icon: Sparkles },
  { id: 'crop', label: 'Crop', icon: Crop },
  { id: 'rotate', label: 'Rotate', icon: RotateCw },
  { id: 'flip', label: 'Flip', icon: FlipHorizontal2 },
  { id: 'canvas', label: 'Canvas', icon: Frame },
  { id: 'adjust', label: 'Adjust', icon: SlidersHorizontal }
] as const;

const stageLabels = {
  preparing: 'Preparing source',
  decoding: 'Decoding original',
  processing: 'Applying transformation recipe',
  encoding: 'Encoding final output',
  finalizing: 'Verifying output bytes'
} as const;

export default function EditorPage() {
  const tool = useImageTool();
  const { notify } = useNotifications();
  const [decoded, setDecoded] = useState<DecodedEditorSource>();
  const [analysis, setAnalysis] = useState<EditorImageAnalysis>();
  const [decodeState, setDecodeState] = useState<'idle' | 'decoding' | 'ready' | 'failed'>('idle');
  const [decodeError, setDecodeError] = useState<string>();
  const [activeTool, setActiveTool] = useState<EditorTool>('crop');
  const [inspectorPanel, setInspectorPanel] = useState<'adjust' | 'history'>('adjust');
  const [compareMode, setCompareMode] = useState<EditorCompareMode>('slider');
  const [comparison, setComparison] = useState(50);
  const [zoom, setZoom] = useState<EditorZoom>('fit');
  const [exportSettings, setExportSettings] = useState<EditorExportSettings>({
    format: 'webp',
    quality: 82
  });
  const [history, dispatch] = useReducer(
    editorHistoryReducer,
    createEditorHistory(createEditorRecipe(1, 1))
  );
  const sourceFile = tool.file;
  const sourceValidation = tool.validation;
  const discardOutput = tool.discardOutput;

  useEffect(() => {
    if (!sourceFile || !sourceValidation?.supportedByConverter) return;

    let cancelled = false;
    let source: DecodedEditorSource | undefined;
    void decodeEditorSource(sourceFile, sourceValidation.format, sourceValidation.mime)
      .then((nextSource) => {
        source = nextSource;
        if (cancelled) {
          nextSource.dispose();
          return;
        }
        const recipe = createEditorRecipe(nextSource.width, nextSource.height);
        setDecoded(nextSource);
        setAnalysis(undefined);
        dispatch({ type: 'replace-source', recipe });
        setDecodeState('ready');
        setActiveTool('adjust');
        setInspectorPanel('adjust');
        setZoom('fit');
        setComparison(50);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const appError = toAppError(error, 'DECODE_FAILED');
        setDecodeError(appError.userMessage);
        setDecodeState('failed');
      });

    return () => {
      cancelled = true;
      source?.dispose();
    };
  }, [sourceFile, sourceValidation]);

  useEffect(() => {
    if (!decoded) return;
    let cancelled = false;
    void analyzeEditorSource(decoded)
      .then((result) => {
        if (!cancelled) setAnalysis(result);
      })
      .catch(() => {
        if (!cancelled) setAnalysis(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [decoded]);

  const undo = useCallback(() => {
    discardOutput();
    dispatch({ type: 'undo' });
  }, [discardOutput]);

  const redo = useCallback(() => {
    discardOutput();
    dispatch({ type: 'redo' });
  }, [discardOutput]);

  const restoreOriginal = useCallback(() => {
    discardOutput();
    dispatch({ type: 'restore-original' });
  }, [discardOutput]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLocaleLowerCase();
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (key === 'y') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redo, undo]);

  const applyRecipe = useCallback(
    (recipe: EditorRecipe, label: string, group?: string) => {
      discardOutput();
      dispatch({
        type: 'apply',
        recipe,
        label,
        ...(group ? { group } : {})
      });
    },
    [discardOutput]
  );

  const changeExportSettings = (settings: EditorExportSettings) => {
    discardOutput();
    setExportSettings(settings);
  };

  const processingOptions = useMemo(
    () => recipeToProcessingOptions(history.present, exportSettings),
    [exportSettings, history.present]
  );
  const geometry = decoded
    ? resolveTransformGeometry(decoded.width, decoded.height, processingOptions)
    : undefined;
  const editCount = countRecipeEdits(history.present, history.original);

  const exportImage = async () => {
    const result = await tool.process(processingOptions, 'edited');
    if (!result) return;
    triggerDownload(result.url, result.filename);
    notify({
      title: 'Edited image exported',
      message: `${result.width} × ${result.height} ${result.mime.replace('image/', '').toUpperCase()} verified locally.`,
      tone: 'success'
    });
  };

  const resetCurrentTool = () => {
    applyRecipe(
      resetToolRecipe(history.present, history.original, activeTool),
      `Reset ${activeTool}`
    );
  };

  const chooseAnother = () =>
    document.querySelector<HTMLInputElement>('.editor-page [data-image-input]')?.click();

  const chooseFile = (file: File | undefined) => {
    if (!file) return;
    setDecoded((current) => {
      current?.dispose();
      return undefined;
    });
    setAnalysis(undefined);
    setDecodeState('decoding');
    setDecodeError(undefined);
    void tool.chooseFile(file);
  };

  const removeFile = () => {
    setDecoded((current) => {
      current?.dispose();
      return undefined;
    });
    setAnalysis(undefined);
    setDecodeState('idle');
    setDecodeError(undefined);
    tool.removeFile();
  };

  return (
    <section className={`editor-page${decoded ? ' editor-page--loaded' : ''}`}>
      <div className="editor-source-input">
        <ImageToolInput
          file={tool.file}
          validation={tool.validation}
          sourceUrl={tool.sourceUrl}
          status={tool.status}
          error={tool.error ?? decodeError}
          actionLabel="Choose an image to edit"
          onChoose={chooseFile}
          onRemove={removeFile}
        />
      </div>

      {!tool.file ? (
        <div className="editor-empty-intro">
          <div>
            <h1>Image Editor</h1>
            <p>Crop, straighten, adjust and compare—without changing the original file.</p>
          </div>
          <div className="editor-empty-assurance">
            <SlidersHorizontal size={20} aria-hidden="true" />
            <span>
              <strong>Non-destructive by design</strong>
              <small>
                Pixavelo stores a transformation recipe and encodes only when you export.
              </small>
            </span>
          </div>
        </div>
      ) : decodeState !== 'ready' || !decoded ? (
        <div className="editor-decoding" role="status">
          {decodeState === 'failed' ? (
            <ImagePlus size={28} />
          ) : (
            <LoaderCircle className="spin" size={28} />
          )}
          <strong>
            {decodeState === 'failed'
              ? 'This image could not be opened'
              : 'Decoding the original locally'}
          </strong>
          <span>{decodeError ?? 'No preview Blob is encoded during editing.'}</span>
        </div>
      ) : (
        <>
          <header className="editor-commandbar">
            <div className="editor-commandbar__identity">
              <h1>Image Editor</h1>
              <span>
                <button type="button" title="Choose another image" onClick={chooseAnother}>
                  {tool.file.name}
                </button>
                <small>
                  {decoded.width} × {decoded.height} · Saved locally
                </small>
              </span>
            </div>
            <div className="editor-commandbar__history">
              <button
                className="button button--secondary"
                type="button"
                disabled={history.past.length === 0}
                onClick={undo}
              >
                <Undo2 size={16} /> <span>Undo</span>
              </button>
              <button
                className="button button--secondary"
                type="button"
                disabled={history.future.length === 0}
                onClick={redo}
              >
                <Redo2 size={16} /> <span>Redo</span>
              </button>
            </div>
            <label className="editor-commandbar__compare">
              <Columns2 size={15} aria-hidden="true" />
              <span className="sr-only">Comparison mode</span>
              <select
                value={compareMode}
                aria-label="Comparison mode"
                onChange={(event) => setCompareMode(event.currentTarget.value as EditorCompareMode)}
              >
                <option value="slider">Compare: Slider</option>
                <option value="side-by-side">Side-by-side</option>
                <option value="original">Original only</option>
                <option value="output">Output only</option>
              </select>
            </label>
            <div className="editor-commandbar__export">
              <span>
                Original preserved · {editCount} edit{editCount === 1 ? '' : 's'}
              </span>
              <button
                className="button button--primary"
                type="button"
                disabled={tool.status === 'processing'}
                onClick={() => void exportImage()}
              >
                {tool.status === 'processing' ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <Download size={17} />
                )}
                {tool.status === 'processing' ? 'Exporting' : 'Export image'}
              </button>
            </div>
          </header>

          <div className="editor-workspace">
            <nav className="editor-toolrail" aria-label="Editor tools">
              {tools.map((entry) => {
                const Icon = entry.icon;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    aria-pressed={activeTool === entry.id}
                    onClick={() => {
                      setActiveTool(entry.id);
                      setInspectorPanel('adjust');
                    }}
                  >
                    <Icon size={18} />
                    <span>{entry.label}</span>
                  </button>
                );
              })}
            </nav>

            <EditorCanvas
              source={decoded}
              recipe={history.present}
              activeTool={activeTool}
              compareMode={compareMode}
              comparison={comparison}
              zoom={zoom}
              onComparison={setComparison}
              onCompareMode={setCompareMode}
              onZoom={setZoom}
              onCropChange={(crop) =>
                applyRecipe({ ...history.present, crop }, 'Crop image', 'crop-drag')
              }
            />

            <EditorInspector
              activeTool={activeTool}
              panel={inspectorPanel}
              history={history}
              analysis={analysis}
              output={exportSettings}
              outputWidth={geometry?.outputWidth ?? decoded.width}
              outputHeight={geometry?.outputHeight ?? decoded.height}
              onPanel={setInspectorPanel}
              onApply={applyRecipe}
              onOutput={changeExportSettings}
              onUndo={undo}
              onRedo={redo}
              onResetTool={resetCurrentTool}
              onRestoreOriginal={restoreOriginal}
            />
          </div>

          <footer className="editor-metadata" aria-label="Editor file information">
            <span>
              <strong>Source</strong>
              {tool.validation?.format.toUpperCase()} · {decoded.width} × {decoded.height} ·{' '}
              {formatBytes(tool.file.size)}
            </span>
            <span data-testid="editor-encoding-state">
              <strong>Output {tool.output ? '' : '(planned)'}</strong>
              {exportSettings.format.toUpperCase()} · {geometry?.outputWidth} ×{' '}
              {geometry?.outputHeight} ·{' '}
              {tool.output
                ? `${formatBytes(tool.output.size)} · ${formatReduction(tool.file.size, tool.output.size)}`
                : 'Encodes on export'}
            </span>
            {tool.status === 'processing' ? (
              <span className="editor-metadata__processing" role="status">
                <LoaderCircle className="spin" size={14} />{' '}
                {tool.stage ? stageLabels[tool.stage] : 'Processing locally'}
              </span>
            ) : tool.output ? (
              <a href={tool.output.url} download={tool.output.filename}>
                <Download size={14} /> Download again
              </a>
            ) : (
              <span className="editor-metadata__privacy">Original pixels retained locally</span>
            )}
          </footer>
        </>
      )}
    </section>
  );
}

function triggerDownload(url: string, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
