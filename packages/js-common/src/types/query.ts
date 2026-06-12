export type SortDirection = "asc" | "desc";

export interface SortParam {
  field: string;
  direction: SortDirection;
}

export interface FilterOperator {
  eq?: unknown;
  neq?: unknown;
  gt?: unknown;
  gte?: unknown;
  lt?: unknown;
  lte?: unknown;
  like?: string;
  notLike?: string;
  ilike?: string;
  notILike?: string;
  in?: unknown[];
}

export type FilterParams = Record<string, FilterOperator | unknown>;

export interface QueryParams {
  sort?: SortParam[];
  filter?: FilterParams;
  offset?: number;
  limit?: number;
  q?: string;
}
