/**
 * OpenAPI 3.1 document for the API. Schemas come from the Zod definitions the
 * handlers validate with; paths and responses are described here.
 */

import { z } from "zod";

import { PROBLEM_CONTENT_TYPE, PROBLEMS, problemTypeUri, type ProblemType } from "@/server/http/problem";
import { CLIENT_ID_HEADER, SESSIONS_PATH } from "@/server/sessions/handlers";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  NewSession,
  PageInfo,
  Session,
  SessionPage,
} from "@/server/sessions/schemas";

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

function componentSchemas() {
  const registry = z.registry<{ id: string }>();
  for (const [id, schema] of Object.entries({ NewSession, Session, SessionPage, PageInfo })) {
    registry.add(schema, { id });
  }
  const { schemas } = z.toJSONSchema(registry, { uri: (id) => `#/components/schemas/${id}` });
  for (const schema of Object.values(schemas)) delete schema.$schema;
  return schemas;
}

const ProblemDetail = {
  type: "object",
  description: "RFC 9457 Problem Details.",
  required: ["type", "title", "status"],
  properties: {
    type: { type: "string", description: "Identifies the problem type.", enum: [...problemTypes(), "about:blank"] },
    title: { type: "string" },
    status: { type: "integer" },
    detail: { type: "string" },
    instance: { type: "string", description: "The request path." },
    errors: {
      type: "array",
      description: "Present on validation problems: one entry per invalid field.",
      items: {
        type: "object",
        required: ["field", "message"],
        properties: { field: { type: "string", examples: ["body.endedAt"] }, message: { type: "string" } },
      },
    },
  },
};

function problemTypes(): string[] {
  return (Object.keys(PROBLEMS) as ProblemType[]).map(problemTypeUri);
}

/** A response that returns one or more problem types. */
function problemResponse(description: string, ...types: ProblemType[]) {
  return {
    description: `${description} (${types.map(problemTypeUri).join(", ")})`,
    content: { [PROBLEM_CONTENT_TYPE]: { schema: { $ref: "#/components/schemas/ProblemDetail" } } },
  };
}

const json = (schema: object) => ({ "application/json": { schema } });

const location = {
  Location: { description: "Where the session can be fetched.", schema: { type: "string" }, example: `${SESSIONS_PATH}/{id}` },
};

const sessionId = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};

const common = {
  400: problemResponse("Missing or malformed X-Client-Id", "missing-client-id"),
  429: problemResponse("Rate limited by the edge firewall", "rate-limited"),
};

export function openApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Cat-modoro API",
      version: "1.0.0",
      description:
        "History of finished Pomodoro phases. Each device is an anonymous client identified by a UUID it generates " +
        `and sends in the \`${CLIENT_ID_HEADER}\` header; it only ever sees its own sessions. Anyone who knows that ` +
        "UUID can read the history, so treat it like a bearer token.",
    },
    servers: [{ url: "/" }],
    security: [{ clientId: [] }],
    tags: [{ name: "Sessions" }],
    paths: {
      [SESSIONS_PATH]: {
        get: {
          tags: ["Sessions"],
          operationId: "listSessions",
          summary: "List sessions, newest first",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", minimum: 0, default: 0 }, description: "Zero-based. A page past the end returns `content: []`." },
            { name: "size", in: "query", schema: { type: "integer", minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE } },
            { name: "from", in: "query", schema: { type: "string", format: "date-time" }, description: "Only sessions started at or after this instant." },
            { name: "to", in: "query", schema: { type: "string", format: "date-time" }, description: "Only sessions started before this instant." },
          ],
          responses: {
            200: { description: "A page of sessions.", content: json(ref("SessionPage")) },
            400: problemResponse("Invalid query or missing X-Client-Id", "validation", "missing-client-id"),
            429: common[429],
          },
        },
        post: {
          tags: ["Sessions"],
          operationId: "createSession",
          summary: "Record a finished session",
          description:
            "Idempotent on `id`: re-sending the same session returns 200 with the stored copy. " +
            "Re-using an id with different data is a 409.",
          requestBody: { required: true, content: json(ref("NewSession")) },
          responses: {
            201: { description: "Recorded.", headers: location, content: json(ref("Session")) },
            200: { description: "Already recorded with identical data (a retry).", headers: location, content: json(ref("Session")) },
            400: problemResponse("Invalid body or missing X-Client-Id", "validation", "missing-client-id"),
            404: problemResponse("The id belongs to another client", "session-not-found"),
            409: problemResponse("The id was already used with different data", "session-conflict"),
            429: common[429],
          },
        },
      },
      [`${SESSIONS_PATH}/{id}`]: {
        parameters: [sessionId],
        get: {
          tags: ["Sessions"],
          operationId: "getSession",
          summary: "Fetch one session",
          responses: {
            200: { description: "The session.", content: json(ref("Session")) },
            400: common[400],
            404: problemResponse("No such session for this client", "session-not-found"),
            429: common[429],
          },
        },
        delete: {
          tags: ["Sessions"],
          operationId: "deleteSession",
          summary: "Delete a session",
          responses: {
            204: { description: "Deleted." },
            400: common[400],
            404: problemResponse("No such session for this client", "session-not-found"),
            429: common[429],
          },
        },
      },
    },
    components: {
      securitySchemes: {
        clientId: { type: "apiKey", in: "header", name: CLIENT_ID_HEADER, description: "Anonymous per-device UUID." },
      },
      schemas: { ...componentSchemas(), ProblemDetail },
    },
  };
}
