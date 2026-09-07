import json, io, sys

base = r'D:\KimiData\kimi\tasks\2026-09-07\02-22-13-267fc560\evidence\B3-1'
fa, fb = sys.argv[1], sys.argv[2]
a = json.load(io.open(f'{base}\\{fa}', encoding='utf-8'))
b = json.load(io.open(f'{base}\\{fb}', encoding='utf-8'))
for key in ('appointment', 'steps', 'photos', 'outbox'):
    print(f'{key} equal:', a[key] == b[key])
