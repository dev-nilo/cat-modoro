import { getDb } from "@/server/db/client";
import { sessionHandlers } from "@/server/sessions/handlers";

const sessions = sessionHandlers(getDb);

export const GET = sessions.get;
export const DELETE = sessions.remove;
