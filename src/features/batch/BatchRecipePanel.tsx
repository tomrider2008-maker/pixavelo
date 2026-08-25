import {
  ChevronDown,
  FileOutput,
  ImageDown,
  RotateCw,
  Save,
  ScanLine,
  ShieldCheck,
  Type,
  Weight
} from 'lucide-react';
import type { BatchRecipe } from './types';
import { batchRecipeSummary } from './recipe';

export function BatchRecipePanel({
  recipe,
  disabled,
  onChange,
  onApply,
  onSave
}: {
  readonly recipe: BatchRecipe;
  readonly disabled: boolean;
  readonly onChange: (recipe: BatchRecipe) => void;
  readonly onApply: () => void;
  readonly onSave: () => void;
}) {
  const update = <Key extends keyof BatchRecipe>(key: Key, value: BatchRecipe[Key]) =>
    onChange({ ...recipe, [key]: value });

  return (
    <aside className="batch-recipe" aria-labelledby="batch-recipe-title">
      <header className="batch-recipe__header">
        <div>
          <h2 id="batch-recipe-title">Batch recipe</h2>
          <p>{batchRecipeSummary(recipe)}</p>
        </div>
        <button type="button" className="batch-text-button" onClick={onSave} disabled={disabled}>
          <Save size={15} aria-hidden="true" /> Save preset
        </button>
      </header>

      <div className="batch-recipe__steps">
        <RecipeStep number={1} icon={FileOutput} label="Convert">
          <label>
            <span className="sr-only">Output format</span>
            <select
              aria-label="Output format"
              value={recipe.outputFormat}
              disabled={disabled}
              onChange={(event) =>
                update('outputFormat', event.currentTarget.value as BatchRecipe['outputFormat'])
              }
            >
              <option value="webp">WebP</option>
              <option value="jpeg">JPEG</option>
              <option value="png">PNG</option>
            </select>
          </label>
        </RecipeStep>

        <RecipeStep number={2} icon={ImageDown} label="Resize">
          <div className="batch-recipe__compound">
            <label>
              <span className="sr-only">Resize mode</span>
              <select
                aria-label="Resize mode"
                value={recipe.resizeMode}
                disabled={disabled}
                onChange={(event) =>
                  update('resizeMode', event.currentTarget.value as BatchRecipe['resizeMode'])
                }
              >
                <option value="longest-edge">Longest edge</option>
                <option value="exact">Exact dimensions</option>
                <option value="none">Keep dimensions</option>
              </select>
            </label>
            {recipe.resizeMode === 'longest-edge' ? (
              <label className="batch-number-field">
                <span className="sr-only">Longest edge</span>
                <input
                  aria-label="Longest edge"
                  type="number"
                  min="32"
                  max="32768"
                  value={recipe.longestEdge}
                  disabled={disabled}
                  onChange={(event) =>
                    update(
                      'longestEdge',
                      clampInteger(event.currentTarget.valueAsNumber, 32, 32768)
                    )
                  }
                />
                <span>px</span>
              </label>
            ) : recipe.resizeMode === 'exact' ? (
              <div className="batch-exact-fields">
                <input
                  aria-label="Batch width"
                  type="number"
                  min="1"
                  max="32768"
                  value={recipe.width}
                  disabled={disabled}
                  onChange={(event) =>
                    update('width', clampInteger(event.currentTarget.valueAsNumber, 1, 32768))
                  }
                />
                <span>×</span>
                <input
                  aria-label="Batch height"
                  type="number"
                  min="1"
                  max="32768"
                  value={recipe.height}
                  disabled={disabled}
                  onChange={(event) =>
                    update('height', clampInteger(event.currentTarget.valueAsNumber, 1, 32768))
                  }
                />
              </div>
            ) : null}
          </div>
        </RecipeStep>

        <RecipeStep number={3} icon={Weight} label="Compress">
          <label className="batch-quality-field">
            <span>Balanced · {recipe.quality}</span>
            <input
              aria-label="Batch quality"
              type="range"
              min="20"
              max="100"
              value={recipe.quality}
              disabled={disabled || recipe.outputFormat === 'png'}
              onChange={(event) => update('quality', event.currentTarget.valueAsNumber)}
            />
          </label>
        </RecipeStep>

        <RecipeStep number={4} icon={RotateCw} label="Orientation">
          <div className="batch-recipe__compound">
            <label>
              <span className="sr-only">Rotation</span>
              <select
                aria-label="Rotation"
                value={recipe.rotation}
                disabled={disabled}
                onChange={(event) => update('rotation', Number(event.currentTarget.value))}
              >
                <option value="0">Normalize</option>
                <option value="90">Rotate 90°</option>
                <option value="180">Rotate 180°</option>
                <option value="270">Rotate 270°</option>
              </select>
            </label>
            <div className="batch-flip-fields">
              <label>
                <input
                  type="checkbox"
                  checked={recipe.flipHorizontal}
                  disabled={disabled}
                  onChange={(event) => update('flipHorizontal', event.currentTarget.checked)}
                />
                Flip H
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={recipe.flipVertical}
                  disabled={disabled}
                  onChange={(event) => update('flipVertical', event.currentTarget.checked)}
                />
                Flip V
              </label>
            </div>
          </div>
        </RecipeStep>

        <RecipeStep number={5} icon={ShieldCheck} label="Metadata">
          <label>
            <span className="sr-only">Metadata policy</span>
            <select aria-label="Metadata policy" value="remove-all" disabled>
              <option value="remove-all">Remove all · GPS included</option>
            </select>
          </label>
          <small>Absence is verified in every encoded output.</small>
        </RecipeStep>

        <RecipeStep number={6} icon={Type} label="Rename">
          <label>
            <span className="sr-only">Naming pattern</span>
            <input
              aria-label="Naming pattern"
              value={recipe.namingPattern}
              disabled={disabled}
              onChange={(event) => update('namingPattern', event.currentTarget.value)}
            />
          </label>
        </RecipeStep>
      </div>

      <details className="batch-watermark">
        <summary>
          <span>
            <ScanLine size={16} aria-hidden="true" /> Optional watermark
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <label className="batch-watermark__toggle">
          <input
            type="checkbox"
            checked={recipe.watermark.enabled}
            disabled={disabled}
            onChange={(event) =>
              update('watermark', { ...recipe.watermark, enabled: event.currentTarget.checked })
            }
          />
          Apply a text watermark
        </label>
        <label>
          <span>Watermark text</span>
          <input
            value={recipe.watermark.text}
            disabled={disabled || !recipe.watermark.enabled}
            onChange={(event) =>
              update('watermark', { ...recipe.watermark, text: event.currentTarget.value })
            }
          />
        </label>
        <label>
          <span>Position</span>
          <select
            value={recipe.watermark.position}
            disabled={disabled || !recipe.watermark.enabled}
            onChange={(event) =>
              update('watermark', {
                ...recipe.watermark,
                position: event.currentTarget.value as BatchRecipe['watermark']['position']
              })
            }
          >
            <option value="bottom-right">Bottom right</option>
            <option value="bottom-left">Bottom left</option>
            <option value="top-right">Top right</option>
            <option value="top-left">Top left</option>
            <option value="center">Center</option>
          </select>
        </label>
      </details>

      <button
        className="button button--primary batch-recipe__apply"
        type="button"
        disabled={disabled}
        onClick={onApply}
      >
        Apply recipe
      </button>
    </aside>
  );
}

function RecipeStep({
  number,
  icon: Icon,
  label,
  children
}: {
  readonly number: number;
  readonly icon: typeof FileOutput;
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="batch-recipe-step">
      <header>
        <Icon size={16} aria-hidden="true" />
        <span className="batch-recipe-step__number">{number}</span>
        <strong>{label}</strong>
      </header>
      {children}
    </section>
  );
}

function clampInteger(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}
