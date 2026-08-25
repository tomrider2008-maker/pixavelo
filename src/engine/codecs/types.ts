import type { CoreImageFormat, ImageFormat } from '../../types/images';

export interface CodecCapabilities {
  readonly id: string;
  readonly label: string;
  readonly supportedInputFormats: readonly ImageFormat[];
  readonly supportedOutputFormats: readonly CoreImageFormat[];
  readonly supportsAlpha: boolean;
  readonly supportsAnimation: boolean;
  readonly supportsLossless: boolean;
  readonly supportsQuality: boolean;
  readonly supportsMetadata: boolean;
  readonly supportsICC: boolean;
  readonly maximumDimensions: number;
  readonly browserDependencies: readonly string[];
  readonly wasmRequired: boolean;
}

export interface ImageCodec {
  readonly capabilities: CodecCapabilities;
  readonly available: boolean;
  readonly unavailableReason?: string;
}

export interface CodecRegistration {
  readonly id: string;
  readonly load: () => Promise<ImageCodec>;
}
