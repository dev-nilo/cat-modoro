import { getDb } from "@/server/db/client";
import { sessionHandlers } from "@/server/sessions/handlers";

const sessions = sessionHandlers(getDb);

export const GET = sessions.list;
export const POST = sessions.create;
