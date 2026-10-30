import React from 'react'
import { register } from 'node:module'

register(`data:text/javascript,${encodeURIComponent(`
export async function load(url, context, nextLoad) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true }
  return nextLoad(url, context)
}
`)}`)

Object.defineProperty(globalThis, 'React', { value: React, configurable: true, writable: true })
