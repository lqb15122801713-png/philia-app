import QRCode from 'qrcode'
import { useEffect, useMemo, useState } from 'react'

const CODE128B_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
] as const

function code128Bars(value: string): { bars: Array<{ x: number; width: number }>; width: number } | null {
  if (!value || [...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) > 126)) return null
  const values = [...value].map((char) => char.charCodeAt(0) - 32)
  const checksum = (104 + values.reduce((sum, item, index) => sum + item * (index + 1), 0)) % 103
  const sequence = [104, ...values, checksum, 106]
  const quiet = 10
  let x = quiet
  const bars: Array<{ x: number; width: number }> = []
  for (const code of sequence) {
    const pattern = CODE128B_PATTERNS[code]
    for (let index = 0; index < pattern.length; index += 1) {
      const width = Number(pattern[index])
      if (index % 2 === 0) bars.push({ x, width })
      x += width
    }
  }
  return { bars, width: x + quiet }
}

export function MemberBarcode({
  token,
  className,
  testId,
}: {
  token: string
  className?: string
  testId?: string
}) {
  const encoded = useMemo(() => code128Bars(token), [token])
  if (!encoded) return null
  return (
    <svg
      className={className}
      data-testid={testId}
      data-token={token}
      viewBox={`0 0 ${encoded.width} 40`}
      role="img"
      aria-label="会员码条形码"
      preserveAspectRatio="none"
    >
      <title>会员码条形码</title>
      {encoded.bars.map((bar, index) => (
        <rect key={`${bar.x}-${index}`} x={bar.x} y={0} width={bar.width} height={40} fill="#5C5040" />
      ))}
    </svg>
  )
}

export function MemberQrCode({ token, size }: { token: string; size: number }) {
  const [result, setResult] = useState<{ token: string; url: string | null }>({ token, url: null })
  const url = result.token === token ? result.url : null
  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(token, {
      width: size,
      margin: 1,
      color: { dark: '#5C5040', light: '#F3EEE4' },
    })
      .then((next) => {
        if (!cancelled) setResult({ token, url: next })
      })
      .catch(() => {
        if (!cancelled) setResult({ token, url: null })
      })
    return () => {
      cancelled = true
    }
  }, [token, size])

  if (url) {
    return (
      <img
        src={url}
        data-testid="membercard-qr-image"
        data-token={token}
        width={size}
        height={size}
        alt="会员码二维码"
      />
    )
  }
  return (
    <span className="membercode-qr-pending" style={{ width: size, height: size }} data-testid="membercard-qr-pending">
      待换
    </span>
  )
}
