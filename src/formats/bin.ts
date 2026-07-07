export function bytesFromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Little-endian view over an embedded binary blob.
export class BinaryView {
  readonly bytes: Uint8Array;
  private dv: DataView;

  constructor(source: string | Uint8Array) {
    this.bytes = typeof source === 'string' ? bytesFromBase64(source) : source;
    this.dv = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
  }

  get length(): number {
    return this.bytes.byteLength;
  }

  i8(o: number): number { return this.dv.getInt8(o); }
  u8(o: number): number { return this.dv.getUint8(o); }
  i16(o: number): number { return this.dv.getInt16(o, true); }
  u16(o: number): number { return this.dv.getUint16(o, true); }
  i32(o: number): number { return this.dv.getInt32(o, true); }
  u32(o: number): number { return this.dv.getUint32(o, true); }
  f32(o: number): number { return this.dv.getFloat32(o, true); }

  cstring(o: number): string {
    let end = o;
    while (end < this.bytes.length && this.bytes[end] !== 0) end++;
    let s = '';
    for (let i = o; i < end; i++) s += String.fromCharCode(this.bytes[i]);
    return s;
  }

  shiftJis(start: number, end: number): string {
    return new TextDecoder('shift_jis').decode(this.bytes.subarray(start, end));
  }
}
