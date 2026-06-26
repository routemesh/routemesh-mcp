export type ApiServerErrorType =
  | "http_error"
  | "network_error"
  | "timeout_error"
  | "invalid_response";

export class ApiServerError extends Error {
  readonly type: ApiServerErrorType;
  readonly status?: number;
  readonly details?: unknown;

  constructor(
    message: string,
    options: {
      type: ApiServerErrorType;
      status?: number;
      details?: unknown;
      cause?: unknown;
    }
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "ApiServerError";
    this.type = options.type;
    if (options.status !== undefined) {
      this.status = options.status;
    }
    if (options.details !== undefined) {
      this.details = options.details;
    }
  }
}

export function formatApiServerError(error: unknown): string {
  if (error instanceof ApiServerError) {
    const statusPart = error.status ? ` (status ${error.status})` : "";
    return `${error.message}${statusPart}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}
