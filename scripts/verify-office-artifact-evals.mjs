#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const evalDir = path.join(root, 'evals', 'office-artifacts');
const trigger = readJson(path.join(evalDir, 'trigger-queries.json'));
const output = readJson(path.join(evalDir, 'output-quality-tasks.json'));

verifyTriggerQueries(trigger);
verifyOutputTasks(output, trigger.skillIds);

console.log(
  `Verified office artifact evals: ${trigger.cases.length} trigger cases, ${output.tasks.length} output tasks.`,
);

function verifyTriggerQueries(data) {
  assert(data.schemaVersion === 1, 'trigger-queries.schemaVersion must be 1');
  assert(Array.isArray(data.skillIds) && data.skillIds.length > 0, 'trigger-queries.skillIds must be non-empty');
  assert(Array.isArray(data.cases) && data.cases.length > 0, 'trigger-queries.cases must be non-empty');

  const known = new Set(data.skillIds);
  const ids = new Set();
  const counts = new Map(data.skillIds.map((id) => [id, { positive: 0, negative: 0, dePositive: 0 }]));

  for (const id of data.skillIds) {
    assertSkillId(id, `skillIds entry ${id}`);
  }

  for (const testCase of data.cases) {
    assertString(testCase.id, 'trigger case id');
    assert(!ids.has(testCase.id), `duplicate trigger case id: ${testCase.id}`);
    ids.add(testCase.id);
    assert(testCase.locale === 'de' || testCase.locale === 'en', `${testCase.id}: locale must be de or en`);
    assertString(testCase.prompt, `${testCase.id}.prompt`);
    assertArray(testCase.expectedSkills, `${testCase.id}.expectedSkills`);
    assertArray(testCase.forbiddenSkills, `${testCase.id}.forbiddenSkills`);
    assertArray(testCase.tags, `${testCase.id}.tags`);

    const expected = new Set(testCase.expectedSkills);
    const forbidden = new Set(testCase.forbiddenSkills);
    assert(expected.size > 0, `${testCase.id}: expectedSkills must be non-empty`);

    for (const skill of expected) {
      assert(known.has(skill), `${testCase.id}: unknown expected skill ${skill}`);
      counts.get(skill).positive += 1;
      if (testCase.locale === 'de') counts.get(skill).dePositive += 1;
    }
    for (const skill of forbidden) {
      assert(known.has(skill), `${testCase.id}: unknown forbidden skill ${skill}`);
      assert(!expected.has(skill), `${testCase.id}: skill appears in expected and forbidden: ${skill}`);
      counts.get(skill).negative += 1;
    }
  }

  for (const [skill, count] of counts.entries()) {
    const total = count.positive + count.negative;
    assert(count.positive >= 8, `${skill}: expected at least 8 positive trigger cases, got ${count.positive}`);
    assert(count.negative >= 8, `${skill}: expected at least 8 negative trigger cases, got ${count.negative}`);
    assert(total >= 20, `${skill}: expected at least 20 total trigger cases, got ${total}`);
    assert(count.dePositive >= 4, `${skill}: expected at least 4 German positive trigger cases, got ${count.dePositive}`);
    console.log(
      `${skill}: ${count.positive} positive, ${count.negative} negative, ${count.dePositive} German positives`,
    );
  }
}

function verifyOutputTasks(data, skillIds) {
  assert(data.schemaVersion === 1, 'output-quality-tasks.schemaVersion must be 1');
  assert(Array.isArray(data.tasks) && data.tasks.length >= 10, 'output-quality-tasks.tasks must contain at least 10 tasks');

  const known = new Set(skillIds);
  const ids = new Set();

  for (const task of data.tasks) {
    assertString(task.id, 'output task id');
    assert(!ids.has(task.id), `duplicate output task id: ${task.id}`);
    ids.add(task.id);
    assertString(task.prompt, `${task.id}.prompt`);
    assertArray(task.expectedSkills, `${task.id}.expectedSkills`);
    assert(task.expectedSkills.length > 0, `${task.id}.expectedSkills must be non-empty`);
    for (const skill of task.expectedSkills) {
      assert(known.has(skill), `${task.id}: unknown expected skill ${skill}`);
    }

    assert(task.expectedArtifact && typeof task.expectedArtifact === 'object', `${task.id}.expectedArtifact is required`);
    assertArray(task.expectedArtifact.extensions, `${task.id}.expectedArtifact.extensions`);
    assert(Number.isInteger(task.expectedArtifact.count), `${task.id}.expectedArtifact.count must be an integer`);

    assertArray(task.rubric, `${task.id}.rubric`);
    assert(task.rubric.length >= 3, `${task.id}.rubric must contain at least 3 criteria`);
    const weightSum = task.rubric.reduce((sum, item, index) => {
      assertString(item.criterion, `${task.id}.rubric[${index}].criterion`);
      assert(Number.isInteger(item.weight) && item.weight > 0, `${task.id}.rubric[${index}].weight must be positive`);
      return sum + item.weight;
    }, 0);
    assert(weightSum === 100, `${task.id}.rubric weights must sum to 100, got ${weightSum}`);
  }
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function assertSkillId(value, label) {
  assertString(value, label);
  assert(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value), `${label} is not a valid skill id`);
}

function assertArray(value, label) {
  assert(Array.isArray(value), `${label} must be an array`);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
