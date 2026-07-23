import { describe, it, expect } from 'vitest';
import {
  company_prompt,
  cross_reference_prompt,
  feedback_prompt,
  writing_style_prompt,
  generate_letter_prompt,
  generate_msg_prompt,
} from '@/app/lib/system-prompt';

const factories = [
  { name: 'generate_letter_prompt', factory: generate_letter_prompt },
  { name: 'generate_msg_prompt', factory: generate_msg_prompt },
];

describe.each(factories)('$name', ({ factory }) => {
  const basePrompt = factory();

  it('returns the base prompt with no argument', () => {
    expect(factory()).toBe(basePrompt);
    expect(basePrompt).not.toContain('ADDITIONAL USER INSTRUCTIONS:');
  });

  it('returns the base prompt for undefined', () => {
    expect(factory(undefined)).toBe(basePrompt);
  });

  it('returns the base prompt for null', () => {
    expect(factory(null)).toBe(basePrompt);
  });

  it('returns the base prompt for empty string', () => {
    expect(factory('')).toBe(basePrompt);
  });

  it('returns the base prompt for whitespace-only string', () => {
    expect(factory('   \n\t  ')).toBe(basePrompt);
  });

  it('appends instructions section when instructions are provided', () => {
    const result = factory('Be concise.');
    expect(result.startsWith(basePrompt)).toBe(true);
    expect(result).toBe(`${basePrompt}\n\nADDITIONAL USER INSTRUCTIONS:\nBe concise.`);
  });

  it('trims leading and trailing whitespace from instructions', () => {
    const result = factory('  Be concise.  \n');
    expect(result).toBe(`${basePrompt}\n\nADDITIONAL USER INSTRUCTIONS:\nBe concise.`);
  });

  it('escapes braces in custom instructions without altering the base prompt', () => {
    const result = factory('Use {tone} and end with {name}');
    const expectedAppended = 'Use {{tone}} and end with {{name}}';
    expect(result).toBe(`${basePrompt}\n\nADDITIONAL USER INSTRUCTIONS:\n${expectedAppended}`);
    expect(result.slice(0, basePrompt.length)).toBe(basePrompt);
  });

  it('does not accumulate instructions across repeated calls', () => {
    const first = factory('First instructions.');
    const second = factory('Second instructions.');
    expect(first).toContain('First instructions.');
    expect(first).not.toContain('Second instructions.');
    expect(second).toContain('Second instructions.');
    expect(second).not.toContain('First instructions.');

    const clean = factory();
    expect(clean).toBe(basePrompt);
    expect(clean).not.toContain('First instructions.');
    expect(clean).not.toContain('Second instructions.');
  });
});

describe('generate_letter_prompt vs generate_msg_prompt', () => {
  it('produce different prompts', () => {
    expect(generate_letter_prompt()).not.toBe(generate_msg_prompt());
  });

  it('both incorporate writing_style_prompt', () => {
    expect(generate_letter_prompt()).toContain(writing_style_prompt);
    expect(generate_msg_prompt()).toContain(writing_style_prompt);
  });
});

describe('static prompts', () => {
  it('company_prompt is a non-empty string with expected headings', () => {
    expect(typeof company_prompt).toBe('string');
    expect(company_prompt.length).toBeGreaterThan(0);
    expect(company_prompt).toContain('### What They Do');
    expect(company_prompt).toContain("### Why They're Hiring");
    expect(company_prompt).toContain('### Culture Signals');
    expect(company_prompt).toContain('### What They Screen For');
  });

  it('cross_reference_prompt is a non-empty string with expected headings', () => {
    expect(typeof cross_reference_prompt).toBe('string');
    expect(cross_reference_prompt.length).toBeGreaterThan(0);
    expect(cross_reference_prompt).toContain('### Your Competitive Advantage');
    expect(cross_reference_prompt).toContain('### Missing Keywords & ATS Gaps');
  });

  it('feedback_prompt is a non-empty string with expected headings', () => {
    expect(typeof feedback_prompt).toBe('string');
    expect(feedback_prompt.length).toBeGreaterThan(0);
    expect(feedback_prompt).toContain('### The Brutal Truth: ATS & Strategy');
    expect(feedback_prompt).toContain('### Semester Action Plan');
  });
});
