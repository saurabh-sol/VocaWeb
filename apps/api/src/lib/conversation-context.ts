export interface ConversationTurn {
  role: string;
  content: string;
}

const MAX_HISTORY_TURNS = 10;

export function formatConversationHistory(
  history: ConversationTurn[] | undefined,
  maxTurns = MAX_HISTORY_TURNS,
): string {
  if (!history?.length) return '';

  const recent = history.slice(-maxTurns);
  const lines = recent.map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content.trim()}`);
  return `\n\nConversation context:\n${lines.join('\n')}`;
}

export function extractPlanFromMessages(
  messages: ConversationTurn[],
): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'assistant') continue;

    const planMatch = msg.content.match(/\[PLAN_START\]([\s\S]*?)\[PLAN_END\]/);
    if (planMatch) return planMatch[1].trim();

    if (msg.content.includes('Project:') && msg.content.includes('Sections:')) {
      return msg.content.trim();
    }
  }
  return undefined;
}

export function buildStructuredBuildDescription(
  messages: ConversationTurn[],
  plan?: string,
): string {
  const confirmedPlan = plan ?? extractPlanFromMessages(messages);
  const recent = messages.slice(-MAX_HISTORY_TURNS);

  const parts: string[] = [];

  if (confirmedPlan) {
    parts.push(`Confirmed build plan:\n${confirmedPlan}`);
  }

  const dialogue = recent
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.trim()}`)
    .join('\n');

  if (dialogue) {
    parts.push(`Recent conversation:\n${dialogue}`);
  }

  return parts.join('\n\n');
}

export function appendTranscriptContext(
  instruction: string,
  transcript?: string,
): string {
  if (!transcript?.trim()) return instruction;
  return `${instruction.trim()}\n\nVoice conversation context:\n${transcript.trim()}`;
}
