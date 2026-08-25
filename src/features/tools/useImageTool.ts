import { useCallback, useEffect, useRef, useState } from 'react';
import { toAppError } from '../../engine/errors/AppError';
import { processNativeImage } from '../../engine/pipeline/processNativeImage';
import { validateImageFile } from '../../engine/validation/validateFile';
import { clearProcessingActivity, setProcessingActivity } from '../../stores/processingActivity';
import type {
  CoreImageFormat,
  ImageValidationReport,
  NativeProcessingOptions,
  ProcessedImage,
  ProcessingStage
} from '../../types/images';
import { buildDerivativeFilename } from '../../utils/filenames';

export type ImageToolStatus =
  | 'empty'
  | 'validating'
  | 'ready'
  | 'processing'
  | 'completed'
  | 'unsupported'
  | 'failed'
  | 'cancelled';

export interface ImageToolOutput extends ProcessedImage {
  readonly url: string;
  readonly filename: string;
}

export function useImageTool() {
  const [file, setFile] = useState<File>();
  const [validation, setValidation] = useState<ImageValidationReport>();
  const [sourceUrl, setSourceUrl] = useState<string>();
  const [output, setOutput] = useState<ImageToolOutput>();
  const [status, setStatus] = useState<ImageToolStatus>('empty');
  const [stage, setStage] = useState<ProcessingStage>();
  const [error, setError] = useState<string>();
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const sourceUrlRef = useRef<string | undefined>(undefined);
  const outputUrlRef = useRef<string | undefined>(undefined);
  const validationSequence = useRef(0);

  const revokeOutput = useCallback(() => {
    if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
    outputUrlRef.current = undefined;
    setOutput(undefined);
  }, []);

  const discardOutput = useCallback(() => {
    revokeOutput();
    setStatus((current) => (current === 'completed' ? 'ready' : current));
  }, [revokeOutput]);

  const chooseFile = useCallback(
    async (nextFile: File | undefined) => {
      if (!nextFile) return;
      validationSequence.current += 1;
      const sequence = validationSequence.current;
      controllerRef.current?.abort();
      revokeOutput();
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
      const nextSourceUrl = URL.createObjectURL(nextFile);
      sourceUrlRef.current = nextSourceUrl;
      setFile(nextFile);
      setSourceUrl(nextSourceUrl);
      setValidation(undefined);
      setError(undefined);
      setStage(undefined);
      setStatus('validating');

      try {
        const report = await validateImageFile(nextFile);
        if (validationSequence.current !== sequence) return;
        setValidation(report);
        if (report.supportedByConverter) {
          setStatus('ready');
        } else {
          setStatus('unsupported');
          setError(`${report.format.toUpperCase()} has no available verified local decoder.`);
        }
        return report;
      } catch (cause: unknown) {
        if (validationSequence.current !== sequence) return;
        const appError = toAppError(cause, 'INVALID_FILE');
        setStatus('failed');
        setError(appError.userMessage);
        return undefined;
      }
    },
    [revokeOutput]
  );

  const removeFile = useCallback(() => {
    validationSequence.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = undefined;
    revokeOutput();
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    sourceUrlRef.current = undefined;
    setFile(undefined);
    setValidation(undefined);
    setSourceUrl(undefined);
    setError(undefined);
    setStage(undefined);
    setStatus('empty');
  }, [revokeOutput]);

  const process = useCallback(
    async (options: NativeProcessingOptions, suffix: string) => {
      if (!file || !validation?.supportedByConverter) return undefined;
      const controller = new AbortController();
      controllerRef.current?.abort();
      controllerRef.current = controller;
      revokeOutput();
      setError(undefined);
      setStatus('processing');
      setStage('preparing');

      try {
        const result = await processNativeImage({
          file,
          detectedMime: validation.mime,
          detectedFormat: validation.format,
          ...(validation.dimensions ? { dimensions: validation.dimensions } : {}),
          options,
          signal: controller.signal,
          onProgress: setStage
        });
        const url = URL.createObjectURL(result.blob);
        outputUrlRef.current = url;
        const nextOutput: ImageToolOutput = {
          ...result,
          url,
          filename: buildDerivativeFilename(file.name, options.outputFormat, suffix)
        };
        setOutput(nextOutput);
        setStage(undefined);
        setStatus('completed');
        return nextOutput;
      } catch (cause: unknown) {
        const appError = toAppError(cause, 'ENCODE_FAILED');
        setStage(undefined);
        setStatus(appError.code === 'CANCELLED' ? 'cancelled' : 'failed');
        setError(appError.userMessage);
        return undefined;
      } finally {
        if (controllerRef.current === controller) controllerRef.current = undefined;
      }
    },
    [file, validation, revokeOutput]
  );

  const cancel = useCallback(() => controllerRef.current?.abort(), []);

  useEffect(() => {
    setProcessingActivity({
      queued: status === 'ready' ? 1 : 0,
      active: status === 'processing' ? 1 : 0,
      ...(stage ? { stage } : {})
    });
    return clearProcessingActivity;
  }, [stage, status]);

  useEffect(
    () => () => {
      validationSequence.current += 1;
      controllerRef.current?.abort();
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
      if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
    },
    []
  );

  return {
    file,
    validation,
    sourceUrl,
    output,
    status,
    stage,
    error,
    chooseFile,
    removeFile,
    discardOutput,
    process,
    cancel
  } as const;
}

export function resolveOutputFormat(
  requested: CoreImageFormat | 'keep',
  validation: ImageValidationReport | undefined
): CoreImageFormat {
  if (requested !== 'keep') return requested;
  return validation?.format === 'png' || validation?.format === 'webp' ? validation.format : 'jpeg';
}
