"""Watermark removal v3.

RGB: base estimate = large-kernel median (flat-style art). Watermark = positive
luminance residual + desaturated vs local median, with low thresholds to catch
white-on-light strokes. Fill from the median estimate, feather edges.

Icon: threshold, keep only the 5 largest components (4 toe beans + heart),
close, fill holes, re-anti-alias.
"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ASSETS = Path(r"D:\KimiData\kimi\tasks\2026-09-04\09-18-08-3ce29f8a\philia\assets")


def clean_rgb(src, dst, size, crop=False, med=41):
    im = Image.open(ASSETS / src).convert("RGB")
    if crop:
        w, h = im.size
        nh = round(size[0] * h / w)
        im = im.resize((size[0], nh), Image.LANCZOS)
        top = (nh - size[1]) // 2
        im = im.crop((0, top, size[0], top + size[1]))
    else:
        im = im.resize(size, Image.LANCZOS)
    a = np.asarray(im).astype(np.float64)
    lum = a.mean(axis=-1)
    sat = a.max(axis=-1) - a.min(axis=-1)
    med_lum = ndimage.median_filter(lum, size=med)
    med_sat = ndimage.median_filter(sat, size=med)
    resid = lum - med_lum
    desat = med_sat - sat
    mask = (resid > 7) & ((desat > 12) | (sat < 25))
    # keep only bright thin structures, not big genuine highlights:
    # remove mask pixels belonging to very large connected bright regions
    mask = ndimage.binary_closing(mask, iterations=2)
    mask = ndimage.binary_dilation(mask, iterations=2)
    print(f"{dst}: watermark px {mask.mean():.4%}")
    fill = np.stack(
        [ndimage.median_filter(a[..., c], size=med) for c in range(3)], axis=-1
    )
    mf = ndimage.gaussian_filter(mask.astype(np.float64), sigma=2.0)[..., None]
    out = a * (1 - mf) + fill * mf
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(ASSETS / dst)
    print(f"{dst}: saved {size}")


def clean_icon():
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
    alpha = np.clip((alpha - 0.35) / 0.5, 0, 1)
    alpha8 = (alpha * 255).astype(np.uint8)
    rgba = np.dstack([
        np.full_like(alpha8, 255), np.full_like(alpha8, 253),
        np.full_like(alpha8, 247), alpha8,
    ])
    Image.fromarray(rgba, "RGBA").resize((256, 256), Image.LANCZOS).save(
        ASSETS / "philia-tab-icon-color-256.png"
    )
    print("icon: saved (256, 256)")


clean_rgb("raw_logo.webp", "philia-logo-512.png", (512, 512), med=35)
clean_icon()
clean_rgb("raw_empty.webp", "philia-empty-appointments-800.png", (800, 600), med=41)
clean_rgb("raw_banner.webp", "philia-banner-home-1200.png", (1200, 500), crop=True, med=51)
