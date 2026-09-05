/**
 * 浏览器定位 hook（T2.1 · HomePage）
 *
 * - 进入页面尝试一次 geolocation（5s 超时，不缓存）；
 * - 拒绝授权 / 不支持 / 超时 → coords=null 且 settled=true（页面降级为无坐标请求）；
 * - 授权成功 → coords={lat,lng}，触发列表按距离重排。
 */

import { useEffect, useState } from 'react'

export interface GeoCoords {
  lat: number
  lng: number
}

export function useGeolocation(): { coords: GeoCoords | null; denied: boolean; settled: boolean } {
  const [coords, setCoords] = useState<GeoCoords | null>(null)
  const [denied, setDenied] = useState(false)
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setSettled(true)
      return
    }
    let alive = true
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!alive) return
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setSettled(true)
      },
      (err) => {
        if (!alive) return
        if (err.code === err.PERMISSION_DENIED) setDenied(true)
        setSettled(true)
      },
      { timeout: 5000, maximumAge: 300_000, enableHighAccuracy: false },
    )
    return () => {
      alive = false
    }
  }, [])

  return { coords, denied, settled }
}
