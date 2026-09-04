"""Final asset assembly.

Logo: rebuild from the cleaned paw-heart silhouette (same shape as the tab
icon -> guaranteed brand consistency): warm apricot vertical gradient on a
cream background, flat vector app-icon style.

Empty-state & banner: targeted second-pass touch-up of faint watermark
remnants inside small bounding boxes only.
"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ASSETS = Path(r"D:\KimiData\kimi\tasks\2026-09-04\09-18-08-3ce29f8a\philia\assets")


def silhouette_mask():
    im = Image.open(ASSETS / "raw_icon.webp").convert("L").resize((512, 512), Image.LANCZOS)
    a = np.asarray(im)
    m = a > 210
    lbl, n = ndimage.label(m)
    if n > 5:
        sizes = ndimage.sum(m, lbl, range(1, n + 1))
        top5 = set((np.argsort(sizes)[-5:] + 1).tolist())
        m = np.isin(lbl, list(top5))
    m = ndimage.binary_closing(m, iterations=3)
    m = ndimage.binary_fill_holes(m)
    alpha = ndimage.gaussian_filter(m.astype(np.float64), sigma=1.2)
    return np.clip((alpha - 0.35) / 0.5, 0, 1)


def build_logo():
    alpha = silhouette_mask()
    h, w = alpha.shape
    # brand gradient: light apricot top -> warm apricot bottom
    top = np.array([0xF2, 0xC9, 0xA4], dtype=np.float64)   # #F2C9A4
    bot = np.array([0xD9, 0x8E, 0x5F], dtype=np.float64)   # #D98E5F
    t = np.linspace(0, 1, h)[:, None, None]
    grad = top[None, None, :] * (1 - t) + bot[None, None, :] * t
    grad = np.broadcast_to(grad, (h, w, 3)).copy()
    bg = np.full((h, w, 3), [0xFB, 0xF7, 0xF2], dtype=np.float64)  # #FBF7F2
    a3 = alpha[..., None]
    out = bg * (1 - a3) + grad * a3
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(
        ASSETS / "philia-logo-512.png"
    )
    print("logo rebuilt from silhouette")


def touch_up(dst, boxes, med=61):
    im = Image.open(ASSETS / dst).convert("RGB")
    a = np.asarray(im).astype(np.float64)
    lum = a.mean(axis=-1)
    sat = a.max(axis=-1) - a.min(axis=-1)
    med_lum = ndimage.median_filter(lum, size=med)
    fill = np.stack(
        [ndimage.median_filter(a[..., c], size=med) for c in range(3)], axis=-1
    )
    mask = np.zeros(lum.shape, dtype=bool)
    for (x0, y0, x1, y1) in boxes:
        sub = ((lum[y0:y1, x0:x1] - med_lum[y0:y1, x0:x1] > 5)
               & (sat[y0:y1, x0:x1] < 40))
        mask[y0:y1, x0:x1] |= sub
    mask = ndimage.binary_dilation(mask, iterations=2)
    print(f"{dst}: touch-up px {mask.mean():.4%}")
    mf = ndimage.gaussian_filter(mask.astype(np.float64), sigma=1.5)[..., None]
    out = a * (1 - mf) + fill * mf
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(ASSETS / dst)
    print(f"{dst}: touched up")


build_logo()
touch_up(
    "philia-empty-appointments-800.png",
    boxes=[(140, 255, 240, 325), (520, 255, 610, 325)],
)
touch_up(
    "philia-banner-home-1200.png",
    boxes=[(430, 165, 720, 250)],
)
