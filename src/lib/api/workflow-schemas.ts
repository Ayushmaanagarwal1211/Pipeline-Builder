import { z } from "zod";

/**
 * Zod schemas for validating workflow payloads at the network boundary.
 *
 * These are intentionally lenient on the node `data` shape — we store it as
 * JSON and trust the client to produce valid shapes (the TS types on the
 * client guarantee this). The server only validates the *graph structure*
 * (ids, positions, references) so malformed requests are rejected early.
 */

const NODE_KINDS = [
  "text",
  "upload-image",
  "upload-video",
  "run-llm",
  "crop-image",
  "extract-frame",
] as const;

const PositionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

const NodeDataSchema = z.looseObject({
  kind: z.enum(NODE_KINDS),
});

export const WorkflowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(NODE_KINDS),
  position: PositionSchema,
  data: NodeDataSchema,
});

export const WorkflowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  animated: z.boolean().optional(),
  type: z.string().optional(),
});

/**
 * Graph-level invariant: every edge must reference existing nodes and every
 * node id must be unique.
 */
export const WorkflowGraphSchema = z
  .object({
    nodes: z.array(WorkflowNodeSchema),
    edges: z.array(WorkflowEdgeSchema),
  })
  .superRefine((graph, ctx) => {
    const nodeIds = new Set<string>();
    for (const node of graph.nodes) {
      if (nodeIds.has(node.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate node id: ${node.id}`,
          path: ["nodes"],
        });
      }
      nodeIds.add(node.id);
    }

    for (const edge of graph.edges) {
      if (!nodeIds.has(edge.source)) {
        ctx.addIssue({
          code: "custom",
          message: `Edge ${edge.id} references unknown source: ${edge.source}`,
          path: ["edges"],
        });
      }
      if (!nodeIds.has(edge.target)) {
        ctx.addIssue({
          code: "custom",
          message: `Edge ${edge.id} references unknown target: ${edge.target}`,
          path: ["edges"],
        });
      }
    }
  });

export const WorkflowNameSchema = z.string().trim().min(1).max(120);

export const CreateWorkflowInputSchema = z.object({
  name: WorkflowNameSchema.optional(),
  nodes: z.array(WorkflowNodeSchema).default([]),
  edges: z.array(WorkflowEdgeSchema).default([]),
});

export const UpdateWorkflowInputSchema = z
  .object({
    name: WorkflowNameSchema.optional(),
    nodes: z.array(WorkflowNodeSchema).optional(),
    edges: z.array(WorkflowEdgeSchema).optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.nodes !== undefined ||
      value.edges !== undefined,
    { message: "At least one field must be provided" },
  );

/**
 * JSON file contents produced by the "Export" action — used by the
 * import endpoint to rehydrate a workflow on another account.
 */
export const WorkflowExportFileSchema = z.object({
  version: z.literal(1),
  name: WorkflowNameSchema,
  nodes: z.array(WorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
  exportedAt: z.string(),
});

export type WorkflowNodeInput = z.infer<typeof WorkflowNodeSchema>;
export type WorkflowEdgeInput = z.infer<typeof WorkflowEdgeSchema>;
export type CreateWorkflowInput = z.infer<typeof CreateWorkflowInputSchema>;
export type UpdateWorkflowInput = z.infer<typeof UpdateWorkflowInputSchema>;
export type WorkflowExportFile = z.infer<typeof WorkflowExportFileSchema>;
