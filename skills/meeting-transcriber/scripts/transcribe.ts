import { context, output } from '@tensorpm/sdk';

type Inputs = {
  audio_path: string;
  model?: 'tiny' | 'base' | 'small';
  language?: string;
};

interface ModelSpec {
  url: string;
  size: number;
  sha256: string;
}

const MODEL_SPECS: Record<Required<Inputs>['model'], ModelSpec> = {
  tiny: {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
    size: 77691713,
    sha256: 'be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21',
  },
  base: {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    size: 147951465,
    sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
  },
  small: {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    size: 487601967,
    sha256: '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b',
  },
};

const inputs = context.inputs as Inputs;
const projectRoot = Deno.env.get('TPM_PROJECT_ROOT');
const runDir = Deno.env.get('TPM_RUN_DIR');

if (!projectRoot || !runDir) {
  throw new Error('Missing TensorPM project/run environment.');
}
if (Deno.build.os !== 'darwin') {
  throw new Error('meeting-transcriber currently supports macOS only.');
}

const audioRel = assertProjectRelative(inputs.audio_path, 'audio_path');
if (!audioRel.startsWith('meetings/')) {
  throw new Error('audio_path must point under meetings/.');
}

const model = inputs.model ?? 'base';
const modelSpec = MODEL_SPECS[model];
const cacheRoot = join(projectRoot, 'skill-cache/meeting-transcriber');
const modelPath = join(cacheRoot, `models/ggml-${model}.bin`);
const audioPath = join(projectRoot, audioRel);
const wavPath = join(runDir, 'meeting-audio-16k.wav');
const stem = safeStem(audioRel);
const outBaseRel = `transcripts/${stem}`;
const outBase = join(projectRoot, outBaseRel);
const markdownRel = `${outBaseRel}.md`;
const textRel = `${outBaseRel}.txt`;
const vttRel = `${outBaseRel}.vtt`;
const jsonRel = `${outBaseRel}.json`;
const whisperCli = join(Deno.cwd(), 'assets/bin/darwin-arm64/whisper-cli');

await ensureModel(modelPath, modelSpec);
await Deno.mkdir(join(projectRoot, 'transcripts'), { recursive: true });

await run('/usr/bin/afconvert', [
  '-f',
  'WAVE',
  '-d',
  'LEI16@16000',
  '-c',
  '1',
  audioPath,
  wavPath,
]);

const whisperArgs = ['-m', modelPath, '-f', wavPath, '-of', outBase, '-otxt', '-ovtt', '-oj'];
if (inputs.language) {
  whisperArgs.push('-l', inputs.language);
}
await run(whisperCli, whisperArgs);

const transcriptText = await Deno.readTextFile(join(projectRoot, textRel));
const markdown = [
  `# Transcript: ${audioRel}`,
  '',
  `- Model: ${model}`,
  `- Source: ${audioRel}`,
  '',
  '## Transcript',
  '',
  transcriptText.trim(),
  '',
].join('\n');
await Deno.writeTextFile(join(projectRoot, markdownRel), markdown);

output({
  audio_path: audioRel,
  model,
  transcript_markdown_path: markdownRel,
  transcript_text_path: textRel,
  transcript_vtt_path: vttRel,
  transcript_json_path: jsonRel,
});

async function ensureModel(path: string, spec: ModelSpec): Promise<void> {
  try {
    const stat = await Deno.stat(path);
    if (stat.isFile && stat.size === spec.size && (await sha256File(path)) === spec.sha256) {
      return;
    }
  } catch {
    // Download below.
  }
  await Deno.mkdir(dirname(path), { recursive: true });
  const tmpPath = `${path}.tmp-${crypto.randomUUID()}`;
  const res = await fetch(spec.url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${spec.url}: HTTP ${res.status}`);
  }
  try {
    const file = await Deno.open(tmpPath, { createNew: true, write: true });
    try {
      await res.body.pipeTo(file.writable);
    } finally {
      try {
        file.close();
      } catch {
        // Already closed by pipeTo.
      }
    }
    const stat = await Deno.stat(tmpPath);
    if (stat.size !== spec.size) {
      throw new Error(`Downloaded model size mismatch: expected ${spec.size}, got ${stat.size}`);
    }
    const actualSha = await sha256File(tmpPath);
    if (actualSha !== spec.sha256) {
      throw new Error(`Downloaded model sha256 mismatch: expected ${spec.sha256}, got ${actualSha}`);
    }
    await Deno.rename(tmpPath, path);
  } catch (err) {
    await Deno.remove(tmpPath).catch(() => undefined);
    throw err;
  }
}

async function sha256File(path: string): Promise<string> {
  const bytes = await Deno.readFile(path);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function run(command: string, args: string[]): Promise<void> {
  const result = await new Deno.Command(command, {
    args,
    stdout: 'piped',
    stderr: 'piped',
  }).output();
  if (!result.success) {
    const stderr = new TextDecoder().decode(result.stderr).trim();
    const stdout = new TextDecoder().decode(result.stdout).trim();
    throw new Error(`${command} failed with code ${result.code}: ${stderr || stdout}`);
  }
}

function assertProjectRelative(value: string, label: string): string {
  if (!value || value.startsWith('/') || value.includes('\\') || value.includes('\0')) {
    throw new Error(`${label} must be a project-relative POSIX path.`);
  }
  const parts = value.split('/').filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === '.' || part === '..')) {
    throw new Error(`${label} must not contain . or .. segments.`);
  }
  return parts.join('/');
}

function safeStem(value: string): string {
  const base = value.split('/').at(-1) ?? 'meeting';
  const withoutExt = base.replace(/\.[^.]+$/, '');
  return withoutExt.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'meeting';
}

function join(root: string, rel: string): string {
  return `${root.replace(/\/+$/, '')}/${rel.replace(/^\/+/, '')}`;
}

function dirname(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx <= 0 ? '/' : path.slice(0, idx);
}
