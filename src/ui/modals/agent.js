// All agent-modal logic lives in src/ui/agents.js.
// This file re-exports for any callers that import from the modal path.
export {
  openAgentModal,
  openNewAgentModal,
  closeAgentModal,
  saveAgent,
  deleteCurrentAgent,
  deleteAgent,
  generateMandate,
  buildColorGrid,
} from '../agents.js';
