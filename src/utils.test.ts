import { describe, test, expect } from 'vitest';

import { replaceImportCodeWithModules, replaceImportFromCodeWithModules } from './utils';

describe('builder', () => {
  describe('replaceCodeWithModules', () => {
    test('happy pass', () => {
      expect(replaceImportCodeWithModules('import "../util/index.js"', (x) => x === 'chunks', '@prefix/')).toMatchInlineSnapshot(
        '"import \\"../util/index.js\\""'
      );
      expect(replaceImportCodeWithModules('import "../chunks/index.js"', (x) => x === 'chunks', '@prefix/')).toMatchInlineSnapshot(
        '"import \\"@prefix/chunks/index.js\\""'
      );
      expect(replaceImportCodeWithModules('import "../chunks/index.js"', (x) => x === 'chunks', '@prefix/')).toMatchInlineSnapshot(
        '"import \\"@prefix/chunks/index.js\\""'
      );
      expect(replaceImportCodeWithModules('import "../chunks"', (x) => x === 'chunks', '@prefix/')).toMatchInlineSnapshot('"import \\"../chunks\\""');
    });
  });

  describe(
    'replaceImportFromCodeWithModules',
    () => {
      test('happy pass', () => {
        expect(replaceImportFromCodeWithModules('import x from "../util/index.js"', (x) => x === 'chunks', '@prefix/')).toMatchInlineSnapshot(
          '"import x from \\"../util/index.js\\""'
        );
        expect(replaceImportFromCodeWithModules('import x from "../chunks/index.js"', (x) => x === 'chunks', '@prefix/')).toMatchInlineSnapshot(
          '"import x from \\"@prefix/chunks/index.js\\""'
        );
        expect(replaceImportFromCodeWithModules('import x from "../chunks/index.js"', (x) => x === 'chunks', '@prefix/')).toMatchInlineSnapshot(
          '"import x from \\"@prefix/chunks/index.js\\""'
        );
        expect(replaceImportFromCodeWithModules('import x from "../chunks"', (x) => x === 'chunks', '@prefix')).toMatchInlineSnapshot(
          '"import x from \\"../chunks\\""'
        );
      });
    },
    Infinity
  );
});
