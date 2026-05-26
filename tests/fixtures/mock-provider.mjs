#!/usr/bin/env node

const args = process.argv.slice(2);
const prompt = args.at(-1) ?? '';

console.log('MOCK_PROVIDER_OUTPUT');
console.log(`ARGS=${JSON.stringify(args)}`);
console.log(`PROMPT_LENGTH=${prompt.length}`);
