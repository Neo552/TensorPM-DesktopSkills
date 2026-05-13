---
name: project-pptx
description: Render a PowerPoint (.pptx) deck from an AI-provided slide specification.
version: 1.1.0
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
        description: Optional output filename. ".pptx" is added when omitted. Keep it short and filesystem-safe.
      title:
        type: string
        description: Deck title, used for PowerPoint metadata and as fallback for title slides.
      subtitle:
        type: string
        description: Optional deck subtitle.
      layout:
        type: string
        enum: [wide, standard]
        description: Slide canvas. Defaults to wide 16:9.
      theme:
        type: object
        description: Optional visual theme chosen by the AI.
        properties:
          fontFace:
            type: string
          backgroundColor:
            type: string
            description: Hex color without #, e.g. F8FAFC.
          textColor:
            type: string
          primaryColor:
            type: string
          accentColor:
            type: string
          mutedColor:
            type: string
      slides:
        type: array
        minItems: 1
        maxItems: 30
        description: Complete slide plan. The AI decides slide order, layouts, text, tables, metrics, shapes, notes, and styling.
        items:
          type: object
          properties:
            layout:
              type: string
              enum: [title, section, bullets, two-column, table, metrics, quote, blank]
              description: High-level layout preset. Elements can override or augment it.
            title:
              type: string
            subtitle:
              type: string
            notes:
              type: string
              description: Optional speaker notes.
            backgroundColor:
              type: string
            bullets:
              type: array
              items:
                type: string
            left:
              type: array
              items:
                type: string
              description: Left-column bullets for two-column layout.
            right:
              type: array
              items:
                type: string
              description: Right-column bullets for two-column layout.
            table:
              type: object
              properties:
                headers:
                  type: array
                  items:
                    type: string
                rows:
                  type: array
                  items:
                    type: array
                    items:
                      type: string
            metrics:
              type: array
              items:
                type: object
                properties:
                  label:
                    type: string
                  value:
                    type: string
                  note:
                    type: string
            quote:
              type: string
            attribution:
              type: string
            elements:
              type: array
              description: Optional precise elements. Coordinates are inches from the top-left of the slide.
              items:
                type: object
                properties:
                  type:
                    type: string
                    enum: [text, bullets, table, metric, shape]
                  text:
                    type: string
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
                  label:
                    type: string
                  value:
                    type: string
                  note:
                    type: string
                  shape:
                    type: string
                    enum: [rect, roundRect, line]
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
                  italic:
                    type: boolean
        required: [layout]
    required: [slides]
  output:
    type: object
    properties:
      artifact:
        type: string
        description: Filename of the generated .pptx artifact.
      slideCount:
        type: integer
      title:
        type: string
    required: [artifact, slideCount, title]
---

# project-pptx

Render a `.pptx` artifact from the supplied `slides` array.

## When to use

Use when the user asks for PowerPoint, slides, a presentation, pitch deck,
status deck, board deck, workshop deck, or similar `.pptx` output.

## Contract

The caller decides the narrative, language, slide count, layout, copy,
colors, tables, metrics, notes, and precise element placement. This skill
only renders the specification. It does not read project data, call an AI
provider, or use the network.
