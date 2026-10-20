import { useMutation } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { usePhiliaClient } from '@philia/shared'

function useCountdown(expiresAt: Date | string | undefined): { mm: string; ss: string; expired: boolean } {
  const [now, setNow] = useState(() => Date.now())
  const expMs = expiresAt ? new Date(expiresAt).getTime() : 0
  useEffect(() => {
    if (!expMs) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [expMs])
  const left = Math.max(0, Math.floor((expMs - now) / 1000))
  return {
    mm: String(Math.floor(left / 60)).padStart(2, '0'),
    ss: String(left % 60).padStart(2, '0'),
    expired: !!expMs && left <= 0,
  }
}

export function useMemberCardToken(enabled: boolean) {
  const { trpc } = usePhiliaClient()
  const tokenM = useMutation({
    mutationFn: () => trpc.membership.myCardToken.mutate(),
  })
  const { mutate } = tokenM
  const issue = useCallback(() => mutate(), [mutate])

  useEffect(() => {
    if (!enabled) return
    issue()
    const timer = window.setInterval(issue, 5 * 60_000)
    return () => window.clearInterval(timer)
  }, [enabled, issue])

  const countdown = useCountdown(tokenM.data?.expiresAt)
  useEffect(() => {
    if (enabled && countdown.expired) issue()
  }, [countdown.expired, enabled, issue])

  return {
    token: tokenM.data?.token ?? null,
    expiresAt: tokenM.data?.expiresAt,
    issue,
    isPending: tokenM.isPending && !tokenM.data,
    isError: tokenM.isError && !tokenM.data,
    countdown,
  }
}
