export interface PaginationParams {
  page?: number
  pageSize?: number
}

export interface PaginationResult<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    pages: number
    hasMore: boolean
  }
}

export function calculatePagination(page: number = 1, pageSize: number = 25) {
  const skip = Math.max(0, (page - 1) * pageSize)
  return { skip, take: pageSize }
}

export function getPaginationMeta(
  total: number,
  page: number,
  pageSize: number
) {
  const pages = Math.ceil(total / pageSize)
  return {
    page: Math.max(1, page),
    pageSize,
    total,
    pages,
    hasMore: page < pages
  }
}
