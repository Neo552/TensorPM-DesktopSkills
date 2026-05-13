---
name: project-docx
description: Render a Word (.docx) document from an AI-provided document specification.
version: 1.0.0
runtime:
  engine: deno
  entrypoint: scripts/main.ts
permissions:
  tensorpm:
    action_items: none
    decisions: none
    history: none
  network: none
  ai_provider: none
limits:
  cpu_seconds: 30
  memory_mb: 256
schema:
  input:
    type: object
    properties:
      filename:
        type: string
      title:
        type: string
      creator:
        type: string
      blocks:
        type: array
        minItems: 1
        maxItems: 200
        items:
          type: object
          properties:
            type:
              type: string
              enum: [heading, paragraph, bullets, table, pageBreak]
            text:
              type: string
            level:
              type: integer
              minimum: 1
              maximum: 6
            runs:
              type: array
              items:
                type: object
                properties:
                  text:
                    type: string
                  bold:
                    type: boolean
                  italics:
                    type: boolean
                  underline:
                    type: boolean
            items:
              type: array
              items:
                type: string
            rows:
              type: array
              items:
                type: array
                items:
                  type: string
        required: [type]
    required: [blocks]
  output:
    type: object
    properties:
      artifact:
        type: string
      blockCount:
        type: integer
      title:
        type: string
    required: [artifact, blockCount, title]
---

# project-docx

Render a `.docx` file from document blocks. The caller decides content,
language, section order, headings, tables, and wording. This skill only
renders the specification with the MIT-licensed `docx` library.
