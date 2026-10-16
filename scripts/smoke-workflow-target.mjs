import fs from 'node:fs';
import { workflowSmokeTarget } from '../shared/smoke-target.mjs';

const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const target = workflowSmokeTarget(process.env.GITHUB_EVENT_NAME, event, process.env.GITHUB_SHA);
fs.appendFileSync(process.env.GITHUB_OUTPUT, `url=${target.origin}\nrevision=${target.expected}\n`);
console.log(`Smoke target ${target.origin}; expected deployed source ${target.expected}`);
