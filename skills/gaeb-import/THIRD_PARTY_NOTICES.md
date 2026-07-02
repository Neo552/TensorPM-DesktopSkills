# Third-party notices

`scripts/vendor/fast-xml-parser.mjs` is an esbuild ESM bundle of
[fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser)
5.9.3 (MIT License, Copyright (c) 2017 Amit Kumar Gupta) including its
bundled dependencies, all MIT-licensed:

- strnum 2.4.1 (MIT)
- @nodable/entities 2.2.0 (MIT)
- is-unsafe 1.0.1 (MIT)

The bundle is unmodified output of:
`esbuild node_modules/fast-xml-parser/src/fxp.js --bundle --format=esm --platform=browser --minify`

## Test fixtures

Official GAEB/BVBS interoperability sample files used for testing live in the repo under `tests/gaeb-import/fixtures/`;
see the README there for per-file source URLs and provenance.
