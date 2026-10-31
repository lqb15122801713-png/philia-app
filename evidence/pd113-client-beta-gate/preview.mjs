import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

const root = resolve('E:/KIMI code/pd113-client-beta-gate/apps/customer/dist')
const port = 7143
const upstream = { hostname: '120.53.102.45', port: 7201 }
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const path = url.pathname
    if (path.startsWith('/api/') || path.startsWith('/trpc/')) {
      const proxy = http.request({
        ...upstream,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `${upstream.hostname}:${upstream.port}` },
      }, (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers)
        upstreamRes.pipe(res)
        if (path === '/api/auth/dev-login') {
          console.log(JSON.stringify({ method: req.method, path, status: upstreamRes.statusCode, upstream: 'staging' }))
        }
      })
      proxy.on('error', (error) => {
        res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
        res.end(error.message)
      })
      req.pipe(proxy)
      return
    }

    const requested = decodeURIComponent(path === '/' ? '/index.html' : path)
    let file = resolve(root, `.${requested}`)
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403, { 'cache-control': 'no-store' })
      res.end('forbidden')
      return
    }
    try {
      const info = await stat(file)
      if (!info.isFile()) throw new Error('not a file')
    } catch {
      file = resolve(root, 'index.html')
    }
    const bytes = await readFile(file)
    res.writeHead(200, {
      'content-type': mime[extname(file)] ?? 'application/octet-stream',
      'content-length': bytes.length,
      'cache-control': 'no-store',
    })
    res.end(req.method === 'HEAD' ? undefined : bytes)
  } catch (error) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
    res.end(error instanceof Error ? error.message : 'preview error')
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(JSON.stringify({ url: `http://127.0.0.1:${port}`, tipPackage: false, deployed: false, auxiliaryOnly: true }))
})
