import type { EditorCutoutSettings, EditorPixelOperation } from './editorPixelEdits';

export type ImageFormat =
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'avif'
  | 'bmp'
  | 'gif'
  | 'heic'
  | 'heif'
  | 'tiff'
  | 'svg'
  | 'ico'
  | 'unknown';

export type CoreImageFormat = Extract<ImageFormat, 'jpeg' | 'png' | 'webp'>;

export type DecoderRoute = 'core-native' | 'browser-native' | 'lazy-wasm' | 'lazy-javascript';

export interface InputDecoderDeclaration {
  readonly id: string;
  readonly label: string;
  readonly route: DecoderRoute;
  readonly loadedOnDemand: boolean;
  readonly fallbackLoadedOnDemand?: boolean;
}

export interface ImageDimensions {
  readonly width: number;
  readonly height: number;
  readonly pixels: number;
  readonly megapixels: number;
}

export interface ValidationWarning {
  readonly code:
    | 'EXTENSION_MISMATCH'
    | 'MIME_MISMATCH'
    | 'DIMENSIONS_REQUIRE_DECODER'
    | 'ANIMATION_FIRST_FRAME'
    | 'TIFF_FIRST_PAGE'
    | 'HEIF_PRIMARY_IMAGE'
    | 'ICO_BROWSER_SIZE';
  readonly message: string;
}

export interface ImageValidationReport {
  readonly format: ImageFormat;
  readonly mime: string;
  readonly dimensions?: ImageDimensions;
  readonly supportedByCoreCodec: boolean;
  readonly supportedByConverter: boolean;
  readonly decoder: InputDecoderDeclaration;
  readonly warnings: readonly ValidationWarning[];
}

export type ProcessingStage = 'preparing' | 'decoding' | 'processing' | 'encoding' | 'finalizing';

export interface ImageCrop {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type ImageRotation = number;
export type ImageFitMode = 'contain' | 'cover' | 'stretch' | 'crop' | 'pad';
export type TargetResizeMode = 'quality-only' | 'allow-resize' | 'maximum-visual-quality';

export interface ImageAdjustments {
  readonly brightness: number;
  readonly contrast: number;
  readonly saturation: number;
  readonly exposure: number;
  readonly highlights: number;
  readonly shadows: number;
  readonly temperature: number;
  readonly tint: number;
  readonly gamma: number;
  readonly sharpness: number;
  readonly blur: number;
  readonly grayscale: boolean;
  readonly sepia: boolean;
}

export type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface TextWatermarkOptions {
  readonly text: string;
  readonly position: WatermarkPosition;
  readonly opacity: number;
  readonly sizePercent: number;
  readonly color: string;
}

export interface NativeProcessingOptions {
  readonly outputFormat: CoreImageFormat;
  readonly quality?: number;
  readonly targetBytes?: number;
  readonly minimumQuality?: number;
  readonly maximumEncodingPasses?: number;
  readonly width?: number;
  readonly height?: number;
  readonly crop?: ImageCrop;
  readonly rotation?: ImageRotation;
  readonly flipHorizontal?: boolean;
  readonly flipVertical?: boolean;
  readonly fitMode?: ImageFitMode;
  readonly preventUpscale?: boolean;
  readonly background?: string;
  readonly targetResizeMode?: TargetResizeMode;
  readonly maximumResizePasses?: number;
  readonly watermark?: TextWatermarkOptions;
  readonly adjustments?: ImageAdjustments;
  readonly pixelOperations?: readonly EditorPixelOperation[];
  readonly cutout?: EditorCutoutSettings;
}

export interface ProcessedImage {
  readonly blob: Blob;
  readonly mime: string;
  readonly size: number;
  readonly width: number;
  readonly height: number;
  readonly durationMs: number;
  readonly qualityUsed?: number;
  readonly encodingPasses?: number;
  readonly targetSatisfied?: boolean;
  readonly targetResizeApplied?: boolean;
  readonly metadataRemovedVerified: boolean;
}
