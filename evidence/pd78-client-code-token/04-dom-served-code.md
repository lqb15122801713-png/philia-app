# 运行期伺服代码 DOM 面实证（vite dev 7118 实际下发件）

## MemberCodeVisual.tsx（伺服件）
- data-token 命中数: 0
- data-testid=membercard-qr-image 在: 1（QR img 仅存图形 dataURL）

## MemberCardPage.tsx（伺服件）
- membercard-token（旧 sr-only 整串位）命中数: 2
- membercard-copy（旧复制整串钮）命中数: 0
- clipboard/execCommand 命中数: 0

注：`membercard-token` 命中 2 处 = 签发失败分支的 `membercard-token-error`（样式类）与 `membercard-token-retry`（重试钮 testid），均不含令牌值；旧 `data-testid="membercard-token"`（sr-only 整串位）已撤除。
