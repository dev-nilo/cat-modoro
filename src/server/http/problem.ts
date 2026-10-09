/**
 * Errors as RFC 9457 Problem Details (`application/problem+json`).
 *
 * Handlers throw an `ApiError`; `handle()` turns it into a problem response.
 * Anything else becomes a generic 500 with no internals leaked.
 */

export const PROBLEM_CONTENT_TYPE = "application/problem+json";

/** Every problem type the API can return, also published in the OpenAPI document. */
export const PROBLEMS = {
  validation: { status: 400, title: "Invalid request" },
  "missing-client-id": { status: 400, title: "Missing or invalid X-Client-Id header" },
  "session-not-found": { status: 404, title: "Session not found" },
  "session-conflict": { status: 409, title: "Session already exists with different data" },
  "rate-limited": { status: 429, title: "Too many requests" },
} as const;

export type ProblemType = keyof typeof PROBLEMS;

export const problemTypeUri = (type: ProblemType) => `/problems/${type}`;

export interface FieldError {
  /** Dotted path to the offending field, e.g. `body.endedAt` or `query.size`. */
  field: string;
  message: string;
}

export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: FieldError[];
}

export class ApiError extends Error {
  constructor(
    readonly type: ProblemType,
    readonly detail?: string,
    readonly errors?: FieldError[],
  ) {
    super(detail ?? PROBLEMS[type].title);
  }
}

export function problem(body: ProblemDetail, headers?: HeadersInit): Response {
  const h = new Headers(headers);
  h.set("Content-Type", PROBLEM_CONTENT_TYPE);
  return new Response(JSON.stringify(body), { status: body.status, headers: h });
}

export function toProblem(error: unknown, instance: string): Response {
  if (error instanceof ApiError) {
    const { status, title } = PROBLEMS[error.type];
    return problem({
      type: problemTypeUri(error.type),
      title,
      status,
      detail: error.detail,
      instance,
      ...(error.errors && { errors: error.errors }),
    });
  }
  console.error(error);
  return problem({ type: "about:blank", title: "Internal Server Error", status: 500, instance });
}

/** Wraps a route handler so thrown errors come back as Problem Details. */
export function handle<C>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (error) {
      return toProblem(error, new URL(req.url).pathname);
    }
  };
}
