/**
 * Re-exports every Trigger.dev task so the SDK's file scanner discovers them
 * in one place. Direct imports from the consumer side should use
 * the specific task module (not this barrel) to keep tree-shaking effective.
 */
export { runLlmTask } from "./tasks/run-llm";
export { cropImageTask } from "./tasks/crop-image";
export { extractFrameTask } from "./tasks/extract-frame";
export { runWorkflowTask } from "./tasks/run-workflow";
