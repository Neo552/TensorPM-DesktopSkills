---
name: project-xlsx
description: Render an Excel (.xlsx) workbook from an AI-provided workbook specification.
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
      sheets:
        type: array
        minItems: 1
        maxItems: 20
        items:
          type: object
          properties:
            name:
              type: string
            rows:
              type: array
              minItems: 1
              items:
                type: array
                items:
                  anyOf:
                    - type: string
                    - type: number
                    - type: boolean
                    - type: "null"
                    - type: object
                      properties:
                        value: {}
                        formula:
                          type: string
                        format:
                          type: string
                        fontWeight:
                          type: string
                        fontStyle:
                          type: string
                        backgroundColor:
                          type: string
                        textColor:
                          type: string
                        align:
                          type: string
                        columnSpan:
                          type: integer
          required: [name, rows]
    required: [sheets]
  output:
    type: object
    properties:
      artifact:
        type: string
      sheetCount:
        type: integer
    required: [artifact, sheetCount]
---

# project-xlsx

Render an `.xlsx` workbook from sheets and cell data. The caller decides
sheet names, rows, formulas, formatting, and workbook structure. This skill
only renders the specification with the MIT-licensed `write-excel-file`
library.
