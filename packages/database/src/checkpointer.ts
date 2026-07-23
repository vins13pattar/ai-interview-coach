import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

import { databaseUrl } from "./pool";

declare global {
  var interviewCoachCheckpointer: PostgresSaver | undefined;
}

export function getPostgresCheckpointer(): PostgresSaver {
  if (!globalThis.interviewCoachCheckpointer) {
    globalThis.interviewCoachCheckpointer =
      PostgresSaver.fromConnString(databaseUrl());
  }
  return globalThis.interviewCoachCheckpointer;
}
