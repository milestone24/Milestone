export type AuthErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_TOKEN"
  | "SESSION_EXPIRED"
  | "USER_NOT_FOUND"
  | "FORBIDDEN";

export class AuthError extends Error {
  readonly status: number;
  readonly code: AuthErrorCode;

  constructor(
    message: string,
    options: { status?: number; code?: AuthErrorCode } = {},
  ) {
    super(message);
    this.name = "AuthError";
    this.status = options.status ?? 401;
    this.code = options.code ?? "UNAUTHORIZED";
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}
