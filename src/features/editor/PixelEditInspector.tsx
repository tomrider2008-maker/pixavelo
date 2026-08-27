import { Brush, Check, CircleDot, RotateCcw, ShieldCheck, WandSparkles } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { EditorCutoutToolState, EditorRemoveToolState } from './pixelToolState';
import type { EditorTool } from './types';

interface PixelEditInspectorProps {
  readonly activeTool: EditorTool;
  readonly remove: EditorRemoveToolState;
  readonly cutout: EditorCutoutToolState;
  readonly pendingCount: number;
  readonly dirty: boolean;
  readonly supported: boolean;
  readonly showApply: boolean;
  readonly onRemove: (state: EditorRemoveToolState) => void;
  readonly onCutout: (state: EditorCutoutToolState) => void;
  readonly onUndoPending: () => void;
  readonly onClearPending: () => void;
  readonly onApplyPending: () => void;
}

export function PixelEditInspector({
  activeTool,
  remove,
  cutout,
  pendingCount,
  dirty,
  supported,
  showApply,
  onRemove,
  onCutout,
  onUndoPending,
  onClearPending,
  onApplyPending
}: PixelEditInspectorProps) {
  return activeTool === 'remove' ? (
    <fieldset className="editor-control-section">
      <legend>Remove &amp; Heal</legend>
      <p>Paint over distractions. Pixavelo reconstructs pixels from the nearby image—locally.</p>
      <div className="editor-action-pair" aria-label="Removal mode">
        <ModeButton
          active={remove.mode === 'heal'}
          label="Heal"
          icon={<WandSparkles size={15} />}
          onClick={() => onRemove({ ...remove, mode: 'heal' })}
        />
        <ModeButton
          active={remove.mode === 'clone'}
          label="Clone"
          icon={<CircleDot size={15} />}
          onClick={() => onRemove({ ...remove, mode: 'clone', cloneSource: undefined })}
        />
      </div>
      {remove.mode === 'clone' ? (
        <div className="editor-pixel-status" style={statusStyle} role="status">
          <CircleDot size={15} />
          <span style={statusTextStyle}>
            <strong>{remove.cloneSource ? 'Sample locked' : 'Choose a sample'}</strong>
            <small style={mutedStyle}>
              {remove.cloneSource
                ? 'Paint elsewhere to copy these pixels.'
                : 'Click a clean area on the image first.'}
            </small>
          </span>
          {remove.cloneSource ? (
            <button
              className="icon-button icon-button--small"
              type="button"
              aria-label="Clear clone sample"
              onClick={() => onRemove({ ...remove, cloneSource: undefined })}
            >
              <RotateCcw size={14} />
            </button>
          ) : null}
        </div>
      ) : null}
      <PixelRange
        label="Brush"
        value={remove.brushSize}
        minimum={4}
        maximum={240}
        suffix=" px"
        onChange={(brushSize) => onRemove({ ...remove, brushSize })}
      />
      <PixelRange
        label="Hardness"
        value={remove.hardness}
        minimum={5}
        maximum={100}
        suffix="%"
        onChange={(hardness) => onRemove({ ...remove, hardness })}
      />
      <PixelRange
        label="Feather"
        value={remove.feather}
        minimum={0}
        maximum={100}
        suffix="%"
        onChange={(feather) => onRemove({ ...remove, feather })}
      />
      <MaskToggle
        checked={remove.showMask}
        onChange={(showMask) => onRemove({ ...remove, showMask })}
      />
      <PendingActions
        label="removal"
        pendingCount={pendingCount}
        dirty={dirty}
        supported={supported}
        showApply={showApply}
        onUndo={onUndoPending}
        onClear={onClearPending}
        onApply={onApplyPending}
      />
    </fieldset>
  ) : (
    <fieldset className="editor-control-section">
      <legend>Background Cutout</legend>
      <p>Select the background by color, then refine edges with Keep and Remove brushes.</p>
      <div className="editor-format-options" aria-label="Cutout selection mode">
        <ModeButton
          active={cutout.mode === 'wand'}
          label="Wand"
          icon={<WandSparkles size={14} />}
          onClick={() => onCutout({ ...cutout, mode: 'wand' })}
        />
        <ModeButton
          active={cutout.mode === 'keep'}
          label="Keep"
          icon={<Check size={14} />}
          onClick={() => onCutout({ ...cutout, mode: 'keep' })}
        />
        <ModeButton
          active={cutout.mode === 'remove'}
          label="Remove"
          icon={<Brush size={14} />}
          onClick={() => onCutout({ ...cutout, mode: 'remove' })}
        />
      </div>
      {cutout.mode === 'wand' ? (
        <>
          <PixelRange
            label="Tolerance"
            value={cutout.tolerance}
            minimum={0}
            maximum={100}
            suffix="%"
            onChange={(tolerance) => onCutout({ ...cutout, tolerance })}
          />
          <label className="editor-check-control">
            <input
              type="checkbox"
              checked={cutout.connected}
              onChange={(event) => onCutout({ ...cutout, connected: event.currentTarget.checked })}
            />
            Contiguous color only
          </label>
        </>
      ) : (
        <PixelRange
          label="Brush"
          value={cutout.brushSize}
          minimum={4}
          maximum={240}
          suffix=" px"
          onChange={(brushSize) => onCutout({ ...cutout, brushSize })}
        />
      )}
      <div className="editor-pixel-edge-grid" style={edgeGridStyle}>
        <PixelRange
          label="Smooth"
          value={cutout.settings.smooth}
          minimum={0}
          maximum={12}
          suffix=" px"
          onChange={(smooth) => onCutout({ ...cutout, settings: { ...cutout.settings, smooth } })}
        />
        <PixelRange
          label="Feather"
          value={cutout.settings.feather}
          minimum={0}
          maximum={24}
          suffix=" px"
          onChange={(feather) => onCutout({ ...cutout, settings: { ...cutout.settings, feather } })}
        />
        <PixelRange
          label="Edge"
          value={cutout.settings.expand}
          minimum={-8}
          maximum={8}
          suffix=" px"
          onChange={(expand) => onCutout({ ...cutout, settings: { ...cutout.settings, expand } })}
        />
      </div>
      <small className="editor-pixel-label" style={mutedStyle}>
        New background
      </small>
      <div className="editor-format-options" aria-label="Cutout background">
        {(['transparent', 'color', 'blur'] as const).map((background) => (
          <button
            key={background}
            type="button"
            aria-pressed={cutout.settings.background === background}
            onClick={() => onCutout({ ...cutout, settings: { ...cutout.settings, background } })}
          >
            {background === 'transparent' ? 'Clear' : capitalize(background)}
          </button>
        ))}
      </div>
      {cutout.settings.background === 'color' ? (
        <label className="editor-color-control">
          <span>Background color</span>
          <input
            type="color"
            value={cutout.settings.color}
            onChange={(event) =>
              onCutout({
                ...cutout,
                settings: { ...cutout.settings, color: event.currentTarget.value }
              })
            }
          />
        </label>
      ) : null}
      {cutout.settings.background === 'blur' ? (
        <PixelRange
          label="Blur"
          value={cutout.settings.blur}
          minimum={2}
          maximum={36}
          suffix=" px"
          onChange={(blur) => onCutout({ ...cutout, settings: { ...cutout.settings, blur } })}
        />
      ) : null}
      <MaskToggle
        checked={cutout.showMask}
        onChange={(showMask) => onCutout({ ...cutout, showMask })}
      />
      <PendingActions
        label="cutout"
        pendingCount={pendingCount}
        dirty={dirty}
        supported={supported}
        showApply={showApply}
        onUndo={onUndoPending}
        onClear={onClearPending}
        onApply={onApplyPending}
      />
    </fieldset>
  );
}

function ModeButton({
  active,
  label,
  icon,
  onClick
}: {
  readonly active: boolean;
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly onClick: () => void;
}) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function PixelRange({
  label,
  value,
  minimum,
  maximum,
  suffix,
  onChange
}: {
  readonly label: string;
  readonly value: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly suffix: string;
  readonly onChange: (value: number) => void;
}) {
  return (
    <label className="editor-range-control">
      <span>{label}</span>
      <input
        type="range"
        min={minimum}
        max={maximum}
        value={value}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
      <output>
        {value}
        {suffix}
      </output>
    </label>
  );
}

function MaskToggle({
  checked,
  onChange
}: {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <label className="editor-check-control">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      Show editing mask
    </label>
  );
}

function PendingActions({
  label,
  pendingCount,
  dirty,
  supported,
  showApply,
  onUndo,
  onClear,
  onApply
}: {
  readonly label: string;
  readonly pendingCount: number;
  readonly dirty: boolean;
  readonly supported: boolean;
  readonly showApply: boolean;
  readonly onUndo: () => void;
  readonly onClear: () => void;
  readonly onApply: () => void;
}) {
  const hasPending = pendingCount > 0;
  return (
    <>
      {!supported ? (
        <p className="editor-pixel-warning" style={warningStyle} role="alert">
          This full-resolution image is above the 13 MP local retouch limit. Resize it first.
        </p>
      ) : null}
      <div className="editor-pixel-status" style={statusStyle} role="status">
        <ShieldCheck size={15} />
        <span style={statusTextStyle}>
          <strong>{hasPending ? `${pendingCount} pending` : 'Ready for local editing'}</strong>
          <small style={mutedStyle}>No upload, account, model, or paid API.</small>
        </span>
      </div>
      <div className="editor-action-pair">
        <button type="button" disabled={!hasPending} onClick={onUndo}>
          Undo stroke
        </button>
        <button type="button" disabled={!hasPending && !dirty} onClick={onClear}>
          Clear preview
        </button>
      </div>
      {showApply ? (
        <button
          className="button button--primary editor-pixel-apply"
          style={{ width: '100%' }}
          type="button"
          disabled={!supported || (!hasPending && !dirty)}
          onClick={onApply}
        >
          <Check size={16} /> Apply {label}
        </button>
      ) : null}
    </>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const statusStyle: CSSProperties = {
  display: 'flex',
  minHeight: 46,
  alignItems: 'center',
  gap: 8,
  padding: 8,
  color: 'var(--color-accent)',
  background: 'var(--color-surface-selected)',
  border: '1px solid var(--color-border-strong)',
  borderRadius: 7
};

const statusTextStyle: CSSProperties = { display: 'grid', minWidth: 0, flex: 1 };
const mutedStyle: CSSProperties = { color: 'var(--color-text-muted)', fontSize: 9 };
const edgeGridStyle: CSSProperties = { display: 'grid', gap: 9 };
const warningStyle: CSSProperties = {
  padding: 8,
  color: 'var(--color-danger)',
  border: '1px solid var(--color-danger)',
  borderRadius: 6
};
