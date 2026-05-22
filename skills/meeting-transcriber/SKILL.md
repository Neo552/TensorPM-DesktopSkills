---
name: meeting-transcriber
description: Transcribe macOS meeting audio from the project folder with a bundled whisper.cpp CLI, downloading the selected model on first use, and write transcript files back to the project folder.
version: 0.1.0
runtime:
  engine: deno
permissions:
  tensorpm:
    action_items: none
    decisions: none
    history: none
  network:
    - huggingface.co:443
    - cdn-lfs.hf.co:443
    - cas-bridge.xethub.hf.co:443
    - transfer.xethub.hf.co:443
  project_files:
    read:
      - meetings/**
      - skill-cache/meeting-transcriber/**
    write:
      - transcripts/**
      - skill-cache/meeting-transcriber/**
  run:
    - system:afconvert
    - skill:assets/bin/darwin-arm64/whisper-cli
  ai_provider: none
limits:
  cpu_seconds: 300
  memory_mb: 2048
scripts:
  transcribe:
    entrypoint: scripts/transcribe.ts
    description: Decode a project audio file with macOS afconvert, run the bundled whisper.cpp CLI, and save transcript artifacts under transcripts/.
    schema:
      input:
        type: object
        properties:
          audio_path:
            type: string
            description: Project-relative path under meetings/, e.g. meetings/client-sync.m4a.
          model:
            type: string
            enum: [tiny, base, small]
            description: Whisper model to download/use from the local project cache. Defaults to base.
          language:
            type: string
            description: Optional Whisper language code, e.g. de or en.
        required: [audio_path]
      output:
        type: object
        properties:
          audio_path:
            type: string
          model:
            type: string
          transcript_markdown_path:
            type: string
          transcript_text_path:
            type: string
          transcript_vtt_path:
            type: string
          transcript_json_path:
            type: string
        required:
          - audio_path
          - model
          - transcript_markdown_path
          - transcript_text_path
---

# Meeting Transcriber

Use this skill when a user has placed a meeting audio file under `meetings/`
in the project folder and wants a local transcript written under
`transcripts/`.

This is intentionally macOS-only for the first version:

- `afconvert` decodes the source audio to 16 kHz mono WAV.
- A `whisper.cpp` `whisper-cli` binary must be shipped in the installed skill
  payload at `assets/bin/darwin-arm64/whisper-cli`.
- The selected ggml model is downloaded from Hugging Face on first use and
  cached in `skill-cache/meeting-transcriber/models/`.

The script returns project-relative paths for the generated Markdown, TXT,
VTT, and JSON outputs. It does not create TensorPM action items by itself;
the agent should read the transcript and use TensorPM's existing proposal or
action-item tools for human-reviewed meeting notes.
