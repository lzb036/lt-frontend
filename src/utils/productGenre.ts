import type { ProductItem } from '../types/crawler'

type ProductGenreFields = Pick<ProductItem, 'genreId' | 'genrePath'>

export function hasValidProductGenre(product: ProductGenreFields) {
  return /^\d{6}$/.test(String(product.genreId || '').trim())
    && Boolean(String(product.genrePath || '').trim())
}

export function invalidGenreProducts(products: ProductItem[], productIds: number[]) {
  const selectedIds = new Set(productIds)
  return products.filter((product) => selectedIds.has(product.id) && !hasValidProductGenre(product))
}
