import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClientProvider } from '@tanstack/react-query'
import { StaticRouter } from 'react-router-dom/server'
import { createPhiliaClient, PhiliaClientContext } from '@philia/shared'
import App from './App'

const testWindow = {
  location: new URL('http://test.local/login'),
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  },
  sessionStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  },
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}
Object.defineProperty(globalThis, 'window', { value: testWindow, configurable: true, writable: true })
Object.defineProperty(globalThis, 'React', { value: React, configurable: true, writable: true })

test('PD-101／PD-113：/login 产品登录脸提供手机号与内测 code 输入', () => {
  const client = createPhiliaClient('http://127.0.0.1:9')
  client.queryClient.setQueryData(['auth', 'me'], null)

  const html = renderToStaticMarkup(
    <PhiliaClientContext.Provider value={client}>
      <QueryClientProvider client={client.queryClient}>
        <StaticRouter location="/login"><App /></StaticRouter>
      </QueryClientProvider>
    </PhiliaClientContext.Provider>,
  )

  assert.match(html, /data-testid="product-login-form"/)
  assert.match(html, /data-testid="product-login-phone"/)
  assert.match(html, /data-testid="product-login-code"/)
  assert.match(html, /name="code"/)
  assert.match(html, /手机号登录/)
  assert.doesNotMatch(html, /需要访问口令|选择演示账号登录|账号 ID 登录/)
})
