export interface SdErrorData {
  /**
   * The HTTP status message or array of invalid fields.
   * Can also be empty string.
   */
  detail?: string | Array<{ loc: (string | number)[]; msg: string; type: string }>;
  /** Can be e.g. "OutOfMemoryError" or undefined. */
  error?: string;
  /** Empty string. */
  body?: string;
  /** Long description of error. */
  errors?: string;
}

export class SdError extends Error {
  constructor(
    prefix: string,
    public readonly response: Response,
    public readonly body?: SdErrorData,
  ) {
    let message = `${prefix}: ${response.status} ${response.statusText}`;
    if (body?.error) {
      message += `: ${body.error}`;
      if (body.errors) message += ` - ${body.errors}`;
    } else if (typeof body?.detail === "string" && body.detail.length > 0) {
      message += `: ${body.detail}`;
    } else if (body?.detail) {
      message += `: ${JSON.stringify(body.detail)}`;
    }
    super(message);
  }
}
