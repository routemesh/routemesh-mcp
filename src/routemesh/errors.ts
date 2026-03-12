export type RoutemeshErrorType =
  | "http_error"
  | "rpc_error"
  | "network_error"
  | "timeout_error"
  | "invalid_response";

export class RoutemeshError extends Error {
  readonly type: RoutemeshErrorType;
  readonly status?: number;
  readonly details?: unknown;

  constructor(
    message: string,
    options: {
      type: RoutemeshErrorType;
      status?: number;
      details?: unknown;
      cause?: unknown;
    }
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "RoutemeshError";
    this.type = options.type;
    if (options.status !== undefined) {
      this.status = options.status;
    }
    if (options.details !== undefined) {
      this.details = options.details;
    }
  }
}

export function formatToolError(error: unknown): string {
  if (error instanceof RoutemeshError) {
    const statusPart = error.status ? ` (status ${error.status})` : "";
    const details =
      error.details && typeof error.details === "object" && "batchId" in error.details && error.details.batchId
        ? ` (batchId: ${String(error.details.batchId)})`
        : "";
    return `${error.message}${statusPart}${details}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}
