import { DEFAULT_AGENTS, DEF_SYS, DEF_RES, DEF_DATA } from './constants.js';

export const brief = {
  title: 'Grade Dynamics Research Swarm',
  subtitle: 'Multi-agent theoretical exploration of community climb grading systems',
  sysCtx: DEF_SYS,
  resCtx: DEF_RES,
  dataCtx: DEF_DATA,
};

// Mutable array — use splice/push for all mutations (no reassignment)
export const agents = DEFAULT_AGENTS.map(a => ({ ...a }));

export const S = {
  provider: 'gemini',
  apiKeys: { anthropic: '', gemini: '', deepseek: '', openai: '' },
  depth: 'brief',
  synthesisModel: 'sonnet',
  cumulativeCostBaseline: 0,
  selectedAgents: new Set(DEFAULT_AGENTS.map(a => a.id)),
  agentStatuses: Object.fromEntries(DEFAULT_AGENTS.map(a => [a.id, 'active'])),
  currentRound: 0,
  running: false,
  genBlocks: {},
  compressedGen: {},
  currentDebates: {},
  currentSynthesis: null,
  pairingProposals: [],
  retirementProposals: [],
  rounds: [],
  researchMap: [],
  contradictions: [],
  matrix: { dt: [], db: [], st: [], sb: [] },
  overlapScores: {},
  editingAgentId: null,
  agentReflections: {},
  reflectionsEnabled: true,
  _pendingSynthesisArgs: null,
};

export const costS = { inp: 0, out: 0, cw: 0, cr: 0, total: 0, saved: 0, callCount: 0, calls: [] };

// Registry: agentId → { bodyEl, hdrEl } for the live generation card of each agent
export const genCardEls = {};

export let _handoverContent = '';
export let _handoverTitle = '';
export function setHandoverContent(v) { _handoverContent = v; }
export function setHandoverTitle(v) { _handoverTitle = v; }

// Pending mandate update payloads keyed by integer index
export const pendingMandateUpdates = new Map();

// Callback invoked by saveAgent() after a successful save
export let _onAgentSaveCallback = null;
export function setOnAgentSaveCallback(fn) { _onAgentSaveCallback = fn; }
