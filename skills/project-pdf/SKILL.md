---
name: project-pdf
description: Render a PDF document from an AI-provided page and element specification.
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
      pages:
        type: array
        minItems: 1
        maxItems: 100
        items:
          type: object
          properties:
            size:
              type: string
              enum: [letter, a4]
            backgroundColor:
              type: string
            elements:
              type: array
              items:
                type: object
                properties:
                  type:
                    type: string
                    enum: [text, rect, line]
                  text:
                    type: string
                  x:
                    type: number
                  y:
                    type: number
                  w:
                    type: number
                  h:
                    type: number
                  fontSize:
                    type: number
                  color:
                    type: string
                  fill:
                    type: string
                  bold:
                    type: boolean
          required: [elements]
    required: [pages]
  output:
    type: object
    properties:
      artifact:
        type: string
      pageCount:
        type: integer
      title:
        type: string
    required: [artifact, pageCount, title]
---

# project-pdf

Render a PDF from pages and drawing elements. The caller decides content,
page count, coordinates, typography, colors, and layout. This skill only
renders the specification with the MIT-licensed `pdf-lib` library.
