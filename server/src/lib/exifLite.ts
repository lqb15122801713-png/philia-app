/**
 * exifLite：零依赖最简 JPEG EXIF 解析（片 3 B5-2「只许现场拍」兜底闸取数件）。
 *
 * 只取一个字段：ExifIFD 的 DateTimeOriginal（0x9003，拍摄时刻）。
 * 为什么只取它：业务只关心「这张照片是不是服务现场现拍的」，设备/镜头/GPS
 * 等其余 EXIF 域一律不读（少读少泄漏面）。解析失败/非 JPEG/无该域 → null，
 * 由调用方决定放行留痕还是拒（addPhotos 口径：缺 EXIF 只标记不阻断）。
 *
 * 结构：SOI(FFD8) → 逐段扫到 APP1(FFE1) 且载荷以 "Exif\0\0" 开头 → TIFF header
 * （字节序 II/MM + magic 42）→ IFD0 找 ExifIFD 指针（0x8769）→ 子 IFD 找
 * DateTimeOriginal（0x9003，ASCII "YYYY:MM:DD HH:MM:SS"）。
 * 无 ExifIFD 时回落 IFD0 的 DateTime（0x0132，修改时刻——聊胜于无的兜底）。
 * 全程边界防御：任何越界读/非法结构一律 null，绝不抛异常打穿上传链。
 */

/** 解析 JPEG buffer 的 EXIF 拍摄时刻；返回 Unix 秒，解析不出返回 null */
export function readExifTakenAt(buf: Buffer): number | null {
  try {
    if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null; // 非 JPEG
    let pos = 2;
    while (pos + 4 <= buf.length) {
      if (buf[pos] !== 0xff) return null;
      const marker = buf[pos + 1]!;
      // 无长度段（SOI/EOI/RSTn）直接跳过
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        pos += 2;
        continue;
      }
      const len = buf.readUInt16BE(pos + 2);
      if (len < 2 || pos + 2 + len > buf.length) return null;
      if (marker === 0xe1) {
        const segStart = pos + 4;
        // "Exif\0\0" 头校验
        if (
          buf.length >= segStart + 6 &&
          buf[segStart] === 0x45 && // E
          buf[segStart + 1] === 0x78 && // x
          buf[segStart + 2] === 0x69 && // i
          buf[segStart + 3] === 0x66 && // f
          buf[segStart + 4] === 0x00 &&
          buf[segStart + 5] === 0x00
        ) {
          return parseTiff(buf, segStart + 6, pos + 2 + len);
        }
        return null; // APP1 非 Exif（如 XMP）——不再继续扫，JPEG 规范 Exif 必在首个 APP1
      }
      pos += 2 + len;
    }
    return null;
  } catch {
    return null;
  }
}

/** TIFF 区解析：byteOrder + IFD0 → ExifIFD(0x8769) → DateTimeOriginal(0x9003) */
function parseTiff(buf: Buffer, tiffStart: number, tiffEnd: number): number | null {
  if (tiffStart + 8 > tiffEnd) return null;
  const bo = buf.readUInt16BE(tiffStart);
  const le = bo === 0x4949; // 'II' little-endian
  if (!le && bo !== 0x4d4d) return null; // 'MM' big-endian
  const u16 = (off: number) => (le ? buf.readUInt16LE(off) : buf.readUInt16BE(off));
  const u32 = (off: number) => (le ? buf.readUInt32LE(off) : buf.readUInt32BE(off));
  if (u16(tiffStart + 2) !== 42) return null;
  const ifd0 = tiffStart + u32(tiffStart + 4);
  const dt = readIfdStringTag(buf, tiffStart, tiffEnd, ifd0, u16, u32, 0x9003) // 有的机芯直接挂 IFD0
    ?? readIfdStringTag(buf, tiffStart, tiffEnd, ifd0, u16, u32, 0x0132); // 回落 DateTime
  const exifPtr = readIfdPointer(buf, tiffStart, tiffEnd, ifd0, u16, u32, 0x8769);
  const dto = exifPtr !== null
    ? readIfdStringTag(buf, tiffStart, tiffEnd, tiffStart + exifPtr, u16, u32, 0x9003)
    : null;
  return parseExifDateTime(dto ?? dt);
}

/** 读 IFD 中某 tag 的 u32 值（指针型字段用）；找不到/越界返回 null */
function readIfdPointer(
  buf: Buffer,
  tiffStart: number,
  tiffEnd: number,
  ifdOff: number,
  u16: (off: number) => number,
  u32: (off: number) => number,
  tag: number,
): number | null {
  if (ifdOff + 2 > tiffEnd) return null;
  const count = u16(ifdOff);
  for (let i = 0; i < count; i++) {
    const e = ifdOff + 2 + i * 12;
    if (e + 12 > tiffEnd) return null;
    if (u16(e) === tag) return u32(e + 8); // 值=相对 TIFF 头的偏移
  }
  return null;
}

/** 读 IFD 中某 tag 的 ASCII 串（type=2）；count>4 时值在偏移指向处，否则内联 4 字节 */
function readIfdStringTag(
  buf: Buffer,
  tiffStart: number,
  tiffEnd: number,
  ifdOff: number,
  u16: (off: number) => number,
  u32: (off: number) => number,
  tag: number,
): string | null {
  if (ifdOff + 2 > tiffEnd) return null;
  const count = u16(ifdOff);
  for (let i = 0; i < count; i++) {
    const e = ifdOff + 2 + i * 12;
    if (e + 12 > tiffEnd) return null;
    if (u16(e) !== tag) continue;
    if (u16(e + 2) !== 2) return null; // 非 ASCII 类型不认
    const len = u32(e + 4);
    if (len <= 0 || len > 64) return null;
    const valOff = len <= 4 ? e + 8 : tiffStart + u32(e + 8); // ≤4 字节内联在 value 字段
    if (valOff + len > tiffEnd) return null;
    return buf.toString('ascii', valOff, valOff + len).replace(/\0+$/, '');
  }
  return null;
}

/** "YYYY:MM:DD HH:MM:SS" → Unix 秒（EXIF 无时区，按服务器本地时区解释） */
function parseExifDateTime(s: string | null): number | null {
  if (!s) return null;
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m;
  const t = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se));
  return Number.isNaN(t.getTime()) ? null : Math.floor(t.getTime() / 1000);
}
