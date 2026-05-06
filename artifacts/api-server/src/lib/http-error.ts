export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "HttpError";
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(message: string, code?: string) {
    return new HttpError(400, message, code);
  }

  static notFound(message = "Not found") {
    return new HttpError(404, message);
  }

  static unprocessable(message: string) {
    return new HttpError(422, message);
  }

  static internal(message = "Internal server error") {
    return new HttpError(500, message);
  }
}
