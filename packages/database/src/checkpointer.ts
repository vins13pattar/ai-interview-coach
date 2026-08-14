import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

import { getPool } from "./pool";

declare global {
  var interviewCoachCheckpointer: PostgresSaver | undefined;
}

export function getPostgresCheckpointer(): PostgresSaver {
  if (!globalThis.interviewCoachCheckpointer) {
    globalThis.interviewCoachCheckpointer = new PostgresSaver(getPool());
  }
  return globalThis.interviewCoachCheckpointer;
}
