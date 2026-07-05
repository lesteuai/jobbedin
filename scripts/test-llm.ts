import { ChatOpenAI } from '@langchain/openai';

const reasoningLlm = new ChatOpenAI({
  modelName: process.env.REASONING_MODEL ?? 'meta-llama/llama-3.1-8b-instruct',
  apiKey: process.env.OPENROUTER_API_KEY,
  configuration: { baseURL: 'https://openrouter.ai/api/v1' },
});

async function main() {
  try {
    const res = await reasoningLlm.invoke('hi');
    console.log('SUCCESS:', res);
  } catch (error) {
    console.log(error?.constructor?.name);
    console.log('ERROR:', error);
  }
}

main();
