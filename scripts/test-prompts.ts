import { generate_letter_prompt, generate_msg_prompt } from '@/app/lib/system-prompt';

const customLetterInstructions = 'Emphasize enthusiasm for remote-first culture and mention my open-source contributions.';
const customMsgInstructions = 'Keep the tone casual and mention I am open to relocating.';

console.log('=== COVER LETTER PROMPT ===\n');
console.log(generate_letter_prompt(customLetterInstructions));

console.log('\n=== MESSAGE PROMPT ===\n');
console.log(generate_msg_prompt(customMsgInstructions));
