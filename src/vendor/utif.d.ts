declare module 'utif' {
  interface ImageFileDirectory {
    width?: number;
    height?: number;
    data?: Uint8Array;
    readonly [tag: string]: unknown;
  }

  interface UtifModule {
    decode(buffer: ArrayBuffer): ImageFileDirectory[];
    decodeImage(buffer: ArrayBuffer, ifd: ImageFileDirectory): void;
    toRGBA8(ifd: ImageFileDirectory): Uint8Array;
    encodeImage(rgba: ArrayBuffer, width: number, height: number): ArrayBuffer;
  }

  const UTIF: UtifModule;
  export default UTIF;
}
