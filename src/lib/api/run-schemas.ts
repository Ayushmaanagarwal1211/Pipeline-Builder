import { RunScope } from "@prisma/client";
import { z } from "zod";

export const StartRunInputSchema = z.object({
  workflowId: z.string().min(1),
  scope: z.enum(RunScope),
  selection: z.array(z.string()).optional(),
});

export type StartRunRequest = z.infer<typeof StartRunInputSchema>;
