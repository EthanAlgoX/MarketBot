import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Handler without clawdbot type import for portability
const handler = async (event: { type: string; action: string }) => {
  if (event.type !== 'agent' || event.action !== 'bootstrap') {
    return;
  }

  try {
    const moltbotDir = join(homedir(), '.clawface');
    const stateFile = join(moltbotDir, 'avatar_state.json');
    
    mkdirSync(moltbotDir, { recursive: true });
    
    writeFileSync(stateFile, JSON.stringify({
      emotion: 'thinking',
      action: 'thinking',
      effect: 'brainwave',
      message: '...'
    }));
  } catch (err) {
    console.error('[avatar-thinking] Failed:', err instanceof Error ? err.message : String(err));
  }
};

export default handler;
