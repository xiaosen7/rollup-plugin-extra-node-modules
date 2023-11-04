import fs from "fs/promises";
import path, { join } from "path";

import { npmUtils } from "./utils";
import _ from "lodash";

import { PathToNameResolver, RollupHelper } from "./models";
import {
  AllSharedNodeModule,
  AssetsNodeModule,
  ChunksNodeModule,
} from "./models/NodeModule";
import { NodeModuleMap } from "./models/NodeModuleMap";

import type * as rollup from "rollup";

export interface ISharedNodeModulePluginOptions {
  /**
   * Your node module prefix.
   * @example "@my-lib/"
   */
  npmPrefix?: string;
  packageJson?: any;
  /**
   * The unprefixed name of chunk type node module.
   * @default "chunk"
   */
  chunkModuleName?: string;
  /**
   * The unprefixed name of assets type node module.
   * @default "assets"
   */
  assetsModuleName?: string;
  cwd?: string;
  /**
   * The unprefixed name of module which exports all node modules you input.
   */
  allSharedModuleName?: string;
  /**
   * Override node module names.
   * @example
   *
   * ```ts
   * {
   * "/a/b/c.ts": "a-b-c"
   * }
   * ```
   */
  overrideNames?: Record<string, string>;
  /**
   * Input files you want to build to node modules, support glob text.
   */
  input: string[];
  /**
   * @default "dist"
   */
  outDir: string;
  /**
   * Whether or not to write dts file with per js files, this option need you provide typescript plugin and build declaration files into assets node module types directory.
   * @default true
   */
  writeDts?: boolean;
}

export async function nodeModulesPlugin(
  options: ISharedNodeModulePluginOptions
): Promise<rollup.Plugin<any>> {
  const {
    cwd = process.cwd(),
    packageJson = JSON.parse(
      await fs.readFile(path.resolve(cwd, "package.json"), "utf-8")
    ),
    npmPrefix = "",
    chunkModuleName = "chunks",
    assetsModuleName = "assets",
    allSharedModuleName = "all-shared",
    overrideNames,
    input,
    outDir = "dist",
    writeDts = true,
  } = options;

  const sharedNameResolver = new PathToNameResolver({
    transform: (s) => `${npmPrefix}${_.kebabCase(s.join(" "))}`,
    overrides: overrideNames,
  });
  const nodeModuleMap = await NodeModuleMap.create(
    input,
    cwd,
    outDir,
    (x) => sharedNameResolver.resolve(x).name
  );
  const rollupHelper = new RollupHelper(nodeModuleMap, npmPrefix);

  const withNpmPrefix = (x: string) => `${npmPrefix}${x}`;

  const prefixedChunksModuleName = withNpmPrefix(chunkModuleName);
  const prefixedAssetsModuleName = withNpmPrefix(assetsModuleName);
  const prefixedAllSharedModuleName = withNpmPrefix(allSharedModuleName);

  return {
    name: "shared-plugin",

    options(options) {
      return {
        ...options,
        input: rollupHelper.getInput(),
      };
    },

    /**
     * Rollup 将所有模块都处理完成以后但还未输出之前会进入到这里
     *
     * generateBundle 会在 outputOptions 之前执行
     * @param options
     * @param bundle
     */
    async generateBundle(options, bundle) {
      // 打包时各个入口文件的公共部分会被 Rollup 生成 chunk
      const chunkNodeModule = new ChunksNodeModule({
        name: prefixedChunksModuleName,
        outDir: join(outDir, prefixedChunksModuleName),
        version: await npmUtils.getNextVersionOfPackage(
          prefixedChunksModuleName,
          "major"
        ),
      });
      nodeModuleMap.set(prefixedChunksModuleName, chunkNodeModule);

      // 资产模块，比如 d.ts 文件
      const assetsNodeModule = new AssetsNodeModule({
        name: prefixedAssetsModuleName,
        outDir: join(outDir, prefixedAssetsModuleName),
        version: await npmUtils.getNextVersionOfPackage(
          prefixedAssetsModuleName,
          "major"
        ),
      });
      nodeModuleMap.set(prefixedAssetsModuleName, assetsNodeModule);

      // 这个模块是用来汇聚所有的共享模块的，内部包含了所有的共享模块
      const allSharedNodeModule = new AllSharedNodeModule({
        name: prefixedAllSharedModuleName,
        nodeModuleMap: nodeModuleMap,
        outDir: join(outDir, prefixedAllSharedModuleName),
        formatDirname: (x: string) => x.replace(npmPrefix, ""),
        version: await npmUtils.getNextVersionOfPackage(
          prefixedAllSharedModuleName,
          "major"
        ),
      });
      nodeModuleMap.set(prefixedAllSharedModuleName, allSharedNodeModule);

      // 把 output 放到 node module 对象当中，方便后续进行处理
      Object.values(bundle).forEach(async (output) => {
        if (output.type === "asset") {
          // assets module 包含类型文件
          nodeModuleMap.get(prefixedAssetsModuleName)!.outputs.push(output);
        } else if (!output.isEntry) {
          // chunks module
          nodeModuleMap.get(prefixedChunksModuleName)!.outputs.push(output);
        } else {
          // shared module
          nodeModuleMap.get(output.name)!.outputs.push(output);
        }
      });
      // 转换代码 导入路径重定向处理
      await nodeModuleMap.transformOutput((x: rollup.OutputChunk) =>
        rollupHelper.transformOutput(x)
      );
      // 外置依赖处理，生成各个模块的外部依赖
      await nodeModuleMap.resolveDependencies(packageJson);
      nodeModuleMap.toArray().forEach(([_, module]) => {
        if (!module.isAssets()) {
          module.dependencies.set(
            prefixedAssetsModuleName,
            assetsNodeModule.version
          );
        }
      });
      // 生成 package.json、README.md
      await nodeModuleMap.writeNodeModuleFiles({
        cwd,
        prefixedAssetsModuleName,
        writeDts,
      });
      // 生成一个汇总 json 文件
      await nodeModuleMap.writeSharedModuleJson(
        join(outDir, "node-modules.json")
      );
    },

    outputOptions(options) {
      return {
        ...options,
        chunkFileNames: `${prefixedChunksModuleName}/[name].js`,
        assetFileNames: `${prefixedAssetsModuleName}/[name].js`,
        entryFileNames: "[name]/index.js",
      };
    },
  };
}
