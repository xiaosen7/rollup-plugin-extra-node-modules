import { resolve } from 'path';

import * as vt from 'vitest';

import { PathToNameResolver } from './PathToNameResolver';

vt.describe(PathToNameResolver.name, () => {
  vt.describe('resolve', () => {
    vt.test('happy pass', () => {
      const resolver = new PathToNameResolver();
      vt.expect(resolver.resolve('src/name/index')).toMatchInlineSnapshot(`
        {
          "name": "name",
          "override": false,
        }
      `);
      vt.expect(resolver.resolve('src/a/index/b')).toMatchInlineSnapshot(`
        {
          "name": "a-b",
          "override": false,
        }
      `);
      vt.expect(resolver.resolve('src/index')).toMatchInlineSnapshot(`
        {
          "name": "root",
          "override": false,
        }
      `);
      vt.expect(resolver.resolve('src/index/')).toMatchInlineSnapshot(`
        {
          "name": "root",
          "override": false,
        }
      `);
      vt.expect(resolver.resolve('chunk')).toMatchInlineSnapshot(`
        {
          "name": "chunk",
          "override": false,
        }
      `);
    });

    vt.test('specify base dir', () => {
      const resolver = new PathToNameResolver({
        baseDir: 'base'
      });
      vt.expect(resolver.resolve('base/src/a/index/b')).toMatchInlineSnapshot(`
        {
          "name": "a-b",
          "override": false,
        }
      `);
    });

    vt.test('specify droppableSegments', () => {
      const resolver = new PathToNameResolver({
        ignoreSegments: ['drop']
      });
      vt.expect(resolver.resolve('drop/a')).toMatchInlineSnapshot(`
        {
          "name": "a",
          "override": false,
        }
      `);
    });

    vt.test('specify rootName', () => {
      const resolver = new PathToNameResolver({
        rootName: 'custom'
      });
      vt.expect(resolver.resolve('src/index')).toMatchInlineSnapshot(`
        {
          "name": "custom",
          "override": false,
        }
      `);
    });

    vt.test('specify transform', () => {
      const resolver = new PathToNameResolver({
        transform: (x) => x.join('$')
      });
      vt.expect(resolver.resolve('src/a/b')).toMatchInlineSnapshot(`
        {
          "name": "a$b",
          "override": false,
        }
      `);
    });

    vt.test('specify overrideSharedNames', () => {
      const resolver = new PathToNameResolver({
        overrides: {
          [resolve('index.ts')]: 'custom'
        }
      });
      vt.expect(resolver.resolve('index.ts')).toMatchInlineSnapshot(`
        {
          "name": "custom",
          "override": true,
        }
      `);
    });

    vt.test('resolveIgnoreOverride', () => {
      const resolver = new PathToNameResolver({
        overrides: {
          [resolve('index.ts')]: 'custom'
        }
      });
      vt.expect(resolver.resolveIgnoreOverrides('index.ts')).toMatchInlineSnapshot(`
        {
          "name": "root",
          "override": false,
        }
      `);
    });

    vt.test('transformFileName', () => {
      const resolver = new PathToNameResolver({
        transformFileName(name) {
          return name.replace('.stories', '');
        }
      });
      vt.expect(resolver.resolve('./src/components/CsfCard.stories.tsx')).toMatchInlineSnapshot(`
        {
          "name": "components-CsfCard",
          "override": false,
        }
      `);
    });
  });
});
