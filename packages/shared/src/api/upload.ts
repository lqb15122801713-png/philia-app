/**
 * 图片上传（契约 docs/CLIENT-CONTRACTS.md · T2.0）
 *
 * uploadImage(baseUrl, file, relDir)：
 * - 上传前 canvas 重采样：最长边 > 2000 时等比缩至 2000，重编码 jpeg 0.85；
 *   原图已 ≤ 2000 或环境不支持 canvas 解码时直接传原图。
 * - POST {baseUrl}/api/upload（multipart：file + relDir，credentials:'include'），
 *   成功返回 { url, thumbUrl }（后端签名 URL，可直接 <img src>）。
 */

/** 重采样目标：最长边像素 */
const MAX_EDGE = 2000;
/** jpeg 重编码质量 */
const JPEG_QUALITY = 0.85;

/** canvas 重采样最长边 2000（jpeg 0.85）；已达标或解码失败返回原 Blob */
async function downscaleImage(file: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('图片重采样失败'))),
        'image/jpeg',
        JPEG_QUALITY,
      );
    });
  } catch {
    // 非图片内容 / 环境不支持 canvas：退回原图，交由服务端校验报错
    return file;
  }
}

/** 上传图片，返回 { url, thumbUrl }（契约签名） */
export async function uploadImage(
  baseUrl: string,
  file: Blob,
  relDir: string,
): Promise<{ url: string; thumbUrl: string }> {
  const blob = await downscaleImage(file);

  const form = new FormData();
  form.append('file', blob, blob.type === 'image/png' ? 'upload.png' : 'upload.jpg');
  form.append('relDir', relDir);

  const res = await fetch(`${baseUrl}/api/upload`, {
    method: 'POST',
    body: form,
    credentials: 'include',
  });

  if (!res.ok) {
    let message = `上传失败（HTTP ${res.status}）`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      // 保留默认错误信息
    }
    throw new Error(message);
  }

  return (await res.json()) as { url: string; thumbUrl: string };
}
