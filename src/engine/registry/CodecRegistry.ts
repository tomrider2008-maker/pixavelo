import { AppError } from '../errors/AppError';
import type { ImageCodec, CodecRegistration } from '../codecs/types';
import type { CoreImageFormat, ImageFormat } from '../../types/images';

export class CodecRegistry {
  readonly #registrations = new Map<string, CodecRegistration>();
  readonly #loaded = new Map<string, Promise<ImageCodec>>();

  public register(registration: CodecRegistration): void {
    if (this.#registrations.has(registration.id)) {
      throw new Error(`Codec “${registration.id}” is already registered.`);
    }
    this.#registrations.set(registration.id, registration);
  }

  public get registeredIds(): readonly string[] {
    return [...this.#registrations.keys()];
  }

  public async load(id: string): Promise<ImageCodec> {
    const registration = this.#registrations.get(id);
    if (!registration) throw new AppError('CODEC_LOAD_FAILED', `Codec “${id}” is not registered.`);

    let codec = this.#loaded.get(id);
    if (!codec) {
      codec = registration.load().catch((error: unknown) => {
        this.#loaded.delete(id);
        throw new AppError(
          'CODEC_LOAD_FAILED',
          error instanceof Error ? error.message : `Codec “${id}” failed to load.`
        );
      });
      this.#loaded.set(id, codec);
    }
    return codec;
  }

  public async findDecoder(format: ImageFormat): Promise<ImageCodec | undefined> {
    return this.find((codec) => codec.capabilities.supportedInputFormats.includes(format));
  }

  public async findEncoder(format: CoreImageFormat): Promise<ImageCodec | undefined> {
    return this.find((codec) => codec.capabilities.supportedOutputFormats.includes(format));
  }

  async find(predicate: (codec: ImageCodec) => boolean): Promise<ImageCodec | undefined> {
    for (const id of this.registeredIds) {
      const codec = await this.load(id);
      if (codec.available && predicate(codec)) return codec;
    }
    return undefined;
  }
}
