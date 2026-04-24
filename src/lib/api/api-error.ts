/**
 * Domain error thrown from the service layer. Route handlers translate it
 * into an HTTP response so handlers never need to build error JSON by hand.
 */
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static notFound(entity: string): ApiError {
    return new ApiError(404, "not_found", `${entity} not found`);
  }

  static unauthorized(message = "Not signed in"): ApiError {
    return new ApiError(401, "unauthorized", message);
  }

  static forbidden(message = "Forbidden"): ApiError {
    return new ApiError(403, "forbidden", message);
  }

  static badRequest(message: string): ApiError {
    return new ApiError(400, "bad_request", message);
  }
}
