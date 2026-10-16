/** D-60：客户页与商家默认编辑稿共用顺序，避免发布后恢复 entries → orderrow 的旧遮挡。 */
export const ME_PAGE_DEFAULT_ORDER = ['me.apphead', 'me.hero', 'me.notify', 'me.orderrow', 'me.entries', 'me.grid'] as const

export const ME_PAGE_BLOCK_RANK: ReadonlyMap<string, number> = new Map(
  ME_PAGE_DEFAULT_ORDER.map((key, index) => [key, index]),
)
