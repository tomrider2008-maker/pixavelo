import { toAppError } from '../../engine/errors/AppError';
import {
  filesWithinCollectionBudget,
  INTAKE_CONCURRENCY
} from '../../engine/memory/browserBudgets';
import { validateImageFile } from '../../engine/validation/validateFile';
import type { ImageValidationReport } from '../../types/images';
import { mapWithConcurrency } from '../../utils/boundedConcurrency';
import type { IntakeAnalysisItem } from './recommendIntakeActions';

type IntakeValidator = (file: File) => Promise<ImageValidationReport>;

export interface AnalyzeIntakeSelectionOptions {
  readonly signal?: AbortSignal;
  readonly validate?: IntakeValidator;
}

export interface IntakeSelectionAnalysis {
  readonly items: readonly IntakeAnalysisItem[];
  readonly excludedCount: number;
}

export async function analyzeIntakeSelection(
  files: readonly File[],
  validateOrOptions: IntakeValidator | AnalyzeIntakeSelectionOptions = validateImageFile
): Promise<IntakeSelectionAnalysis> {
  const options =
    typeof validateOrOptions === 'function' ? { validate: validateOrOptions } : validateOrOptions;
  const validate = options.validate ?? validateImageFile;
  const signal = 'signal' in options ? options.signal : undefined;
  const includedFiles = filesWithinCollectionBudget([], files);
  const items = (
    await mapWithConcurrency(includedFiles, INTAKE_CONCURRENCY, async (file) => {
      if (signal?.aborted) return undefined;

      try {
        return { file, validation: await validate(file) } satisfies IntakeAnalysisItem;
      } catch (cause: unknown) {
        return {
          file,
          error: toAppError(cause, 'INVALID_FILE').userMessage
        } satisfies IntakeAnalysisItem;
      }
    })
  ).filter((item): item is IntakeAnalysisItem => item !== undefined);

  return {
    items,
    excludedCount: files.length - includedFiles.length
  };
}
