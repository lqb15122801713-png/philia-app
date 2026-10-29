import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageChops, ImageStat

root = Path(__file__).resolve().parent
run_stem = sys.argv[1] if len(sys.argv) > 1 else "candidate-hit-green"
output_stem = sys.argv[2] if len(sys.argv) > 2 else "frame-diff"
shots_stem = run_stem.removesuffix("-green")
shots = root / f"{shots_stem}-shots"
open_frame = shots / "eq-03-dialog-open-nofill.png"
aborts = {
    "cancel": "eq-04-abort-cancel.png",
    "esc-trusted": "eq-05-abort-esc-trusted.png",
    "esc-synthetic": "eq-06-abort-esc-synthetic.png",
    "overlay": "eq-07-abort-overlay.png",
}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


with Image.open(open_frame) as source:
    open_rgb = source.convert("RGB")
    pairs = []
    for path, filename in aborts.items():
        after_frame = shots / filename
        with Image.open(after_frame) as target:
            after_rgb = target.convert("RGB")
            if open_rgb.size != after_rgb.size:
                raise AssertionError(f"尺寸不一致：{path}")
            mean_abs = sum(ImageStat.Stat(ImageChops.difference(open_rgb, after_rgb)).mean) / 3
        open_sha = sha256(open_frame)
        after_sha = sha256(after_frame)
        pairs.append({
            "path": path,
            "open": open_frame.name,
            "afterAbort": after_frame.name,
            "openSha256": open_sha,
            "afterAbortSha256": after_sha,
            "distinctHashes": open_sha != after_sha,
            "meanAbsRgb": round(mean_abs, 4),
            "semanticDiff": open_sha != after_sha and mean_abs > 0.5,
            "afterCapturedAt": datetime.fromtimestamp(after_frame.stat().st_mtime, timezone.utc).isoformat(),
        })

result = {
    "window": "PD-111-merchant-daily-close-revert",
    "sourceRun": f"{run_stem}.json",
    "sourceRunSha256": sha256(root / f"{run_stem}.json"),
    "reuseAcrossRuns": False,
    "afterAbortHashesIdenticalAcrossPaths": len({pair["afterAbortSha256"] for pair in pairs}) == 1,
    "note": f"全部帧来自同一次 {run_stem} 新跑；仅比较开闸与对应撤后，不把其他轮次或其他场景帧错对。三撤后像素相同是同一可编辑稳态的预期结果；各路独立 acted、nativeClose、reopen 与摄帧时间戳在 {run_stem}.json 中另证，非同文件复用。",
    "pairs": pairs,
    "allSemanticDiff": all(pair["semanticDiff"] for pair in pairs),
}
(root / f"{output_stem}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result, ensure_ascii=False, indent=2))
if not result["allSemanticDiff"]:
    raise SystemExit(1)
