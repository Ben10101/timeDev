export const DEFAULT_AGENT_LABELS = {
  project_manager: 'PM Agent',
  requirements_analyst: 'Requirements Agent',
  qa_engineer: 'QA Agent',
  architect: 'Architect Agent',
  developer: 'Developer Agent',
  implementation_architect: 'UI Agent',
}

export function getAgentLabel(agentName, fallback = 'Agente') {
  if (!agentName) return fallback
  return DEFAULT_AGENT_LABELS[agentName] || agentName
}
