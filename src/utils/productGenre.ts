import type { ProductItem } from '../types/crawler'

type ProductGenreFields = Pick<ProductItem, 'genreId' | 'genrePath'>

const EDITABLE_PRODUCT_DETAIL_GENRE_STATUSES = new Set(['pending', 'listed'])
const READONLY_PRODUCT_DETAIL_GENRE_STATUSES = new Set(['approved', 'listed_master'])

export function hasValidProductGenre(product: ProductGenreFields) {
  return /^\d{6}$/.test(String(product.genreId || '').trim())
    && Boolean(String(product.genrePath || '').trim())
}

export function invalidGenreProducts(products: ProductItem[], productIds: number[]) {
  const selectedIds = new Set(productIds)
  return products.filter((product) => selectedIds.has(product.id) && !hasValidProductGenre(product))
}

export function shouldShowProductDetailGenre(status: string) {
  return READONLY_PRODUCT_DETAIL_GENRE_STATUSES.has(status)
    || EDITABLE_PRODUCT_DETAIL_GENRE_STATUSES.has(status)
}

export function canEditProductDetailGenre(status: string) {
  return EDITABLE_PRODUCT_DETAIL_GENRE_STATUSES.has(status)
}
