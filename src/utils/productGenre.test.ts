import type { ProductItem } from '../types/crawler'
import {
  canEditProductDetailGenre,
  hasValidProductGenre,
  invalidGenreProducts,
  shouldShowProductDetailGenre,
} from './productGenre.ts'

const validProduct = {
  id: 1,
  genreId: '100001',
  genrePath: '一级>二级',
  genrePathZh: '一级>二级',
} as unknown as ProductItem

const invalidProduct = {
  id: 2,
  genreId: '',
  genrePath: '',
  genrePathZh: '',
} as unknown as ProductItem

if (!hasValidProductGenre(validProduct)) {
  throw new Error('expected a mapped six-digit genre to be valid')
}

if (hasValidProductGenre(invalidProduct)) {
  throw new Error('expected a blank genre to be invalid')
}

const invalid = invalidGenreProducts([validProduct, invalidProduct], [1, 2])
if (invalid.length !== 1 || invalid[0]?.id !== 2) {
  throw new Error('expected selected invalid products only')
}

if (!shouldShowProductDetailGenre('approved')) {
  throw new Error('expected approved product details to show genre')
}

if (canEditProductDetailGenre('approved')) {
  throw new Error('expected approved product genre to be read-only')
}

for (const status of ['pending', 'listed', 'listed_master']) {
  if (!shouldShowProductDetailGenre(status) || !canEditProductDetailGenre(status)) {
    throw new Error(`expected ${status} product genre to remain editable`)
  }
}
