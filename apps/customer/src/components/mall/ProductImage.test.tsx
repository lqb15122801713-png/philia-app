import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ProductImage from './ProductImage'

test('PD-97：已有商品 SVG 必须渲染真图，不得换成待换占位', () => {
  const html = renderToStaticMarkup(createElement(ProductImage, {
    src: '/products/staple-1.svg',
    alt: '全价成犬粮 2kg',
  }))

  assert.match(html, /<img[^>]+src="\/products\/staple-1\.svg"/)
  assert.doesNotMatch(html, /待换/)
})

test('PD-97：商品真缺图时保留诚实替代说明，不得输出待换', () => {
  const html = renderToStaticMarkup(createElement(ProductImage, {
    src: null,
    alt: '全价成犬粮 2kg',
  }))

  assert.match(html, /role="img"[^>]+aria-label="全价成犬粮 2kg"/)
  assert.doesNotMatch(html, /待换/)
})
