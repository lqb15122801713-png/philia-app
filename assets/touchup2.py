"""Aggressive targeted touch-up pass 2 for faint watermark remnants."""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ASSETS = Path(r"D:\KimiData\kimi\tasks\2026-09-04\09-18-08-3ce29f8a\philia\assets")


def touch_up(dst, boxes, med=61, resid_th=3.0, sat_th=60, rounds=2):
    im = Image.open(ASSETS / dst).convert("RGB")
    a = np.asarray(im).astype(np.float64)
    for _ in range(rounds):
        lum = a.mean(axis=-1)
        sat = a.max(axis=-1) - a.min(axis=-1)
        med_lum = ndimage.median_filter(lum, size=med)
        fill = np.stack(
            [ndimage.median_filter(a[..., c], size=med) for c in range(3)], axis=-1
        )
        mask = np.zeros(lum.shape, dtype=bool)
        for (x0, y0, x1, y1) in boxes:
            sub = ((lum[y0:y1, x0:x1] - med_lum[y0:y1, x0:x1] > resid_th)
                   & (sat[y0:y1, x0:x1] < sat_th))
            mask[y0:y1, x0:x1] |= sub
        mask = ndimage.binary_dilation(mask, iterations=2)
        mf = ndimage.gaussian_filter(mask.astype(np.float64), sigma=1.2)[..., None]
        a = a * (1 - mf) + fill * mf
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(ASSETS / dst)
    print(f"{dst}: aggressive touch-up done, px {mask.mean():.4%}")


touch_up(
    "philia-empty-appointments-800.png",
    boxes=[(150, 260, 230, 320), (495, 240, 625, 315)],
)
touch_up(
    "philia-banner-home-1200.png",
    boxes=[(425, 180, 770, 280)],
)
