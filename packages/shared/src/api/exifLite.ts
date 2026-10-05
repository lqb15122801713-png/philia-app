/**
 * JPEG EXIF DateTimeOriginal 最简解析（片 3 B5-2 拍照只许现场拍·前端半，零依赖）：
 * 上传链 canvas 重采样会剥 EXIF（>2000px 必走重编码），故在上传前从**原始文件**预解析
 * 拍摄时刻随件透传；server 侧另有同口径解析（server/src/lib/exifLite.ts，≤2000px 原图
 * 直传时以 server 解析为准）。
 * 口径：EXIF 无时区，按设备本地时区解释（与 server 侧注释同帧）；任何异常=null 兜底。
 */

const SOI = 0xd8ff; // FFD8（DataView getUint16 小端读法下按字节序拼）

function parseExifTakenAt(buf: ArrayBuffer): number | null {
  try {
    const dv = new DataView(buf);
    if (dv.byteLength < 4 || dv.getUint16(0) !== SOI) return null;
    let off = 2;
    // 逐 marker 找 APP1(Exif)
    while (off + 4 <= dv.byteLength) {
      if (dv.getUint8(off) !== 0xff) return null;
      const marker = dv.getUint8(off + 1);
      const len = dv.getUint16(off + 2);
      if (marker === 0xe1) {
        // 'Exif\0\0' 校验
        if (
          dv.getUint8(off + 4) !== 0x45 || dv.getUint8(off + 5) !== 0x78 ||
          dv.getUint8(off + 6) !== 0x69 || dv.getUint8(off + 7) !== 0x66 ||
          dv.getUint8(off + 8) !== 0 || dv.getUint8(off + 9) !== 0
        ) return null;
        const tiff = off + 10;
        const little = dv.getUint16(tiff) === 0x4949; // 'II'
        const u16 = (p: number) => dv.getUint16(tiff + p, little);
        const u32 = (p: number) => dv.getUint32(tiff + p, little);
        if (u16(2) !== 42) return null;
        const ifd = (base: number) => {
          const count = u16(base);
          const tags = new Map<number, { type: number; count: number; valueOff: number }>();
          for (let i = 0; i < count; i++) {
            const e = base + 2 + i * 12;
            if (e + 12 > dv.byteLength - tiff) break;
            tags.set(u16(e), { type: u16(e + 2), count: u32(e + 4), valueOff: e + 8 });
          }
          return tags;
        };
        const ifd0 = ifd(u32(4));
        const exifPtr = ifd0.get(0x8769);
        if (!exifPtr) return null;
        const exifIfd = ifd(u32(exifPtr.valueOff));
        const dto = exifIfd.get(0x9003); // DateTimeOriginal
        if (!dto || dto.type !== 2) return null;
        const start = dto.count <= 4 ? dto.valueOff : u32(dto.valueOff);
        let s = '';
        for (let i = 0; i < 19 && tiff + start + i < dv.byteLength; i++) s += String.fromCharCode(dv.getUint8(tiff + start + i));
        const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(s);
        if (!m) return null;
        const d = new Date(
          Number(m[1]), Number(m[2]) - 1, Number(m[3]),
          Number(m[4]), Number(m[5]), Number(m[6]),
        );
        const t = Math.floor(d.getTime() / 1000);
        return Number.isFinite(t) && t > 0 ? t : null;
      }
      if (marker === 0xda) break; // SOS：图像数据开始，APP1 不会再出现
      off += 2 + len;
    }
    return null;
  } catch {
    return null;
  }
}

/** 从原始图片文件解析拍摄时刻（epoch 秒；非 JPEG/无 EXIF/异常=null） */
export async function readExifTakenAt(file: Blob): Promise<number | null> {
  try {
    if (file.type !== 'image/jpeg' && file.type !== 'image/jpg') return null;
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    return parseExifTakenAt(buf);
  } catch {
    return null;
  }
}
