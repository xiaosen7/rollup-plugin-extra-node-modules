import path, { join } from "path";

import fsx from "fs-extra";
import invariant from "invariant";
import _ from "lodash";
import { dedent } from "ts-dedent";

import type { NodeModuleMap } from "./NodeModuleMap";
import type * as rollup from "rollup";

export enum ENodeModuleKind {
  Shared,
  Chunks,
  Assets,
  AllShared,
}

export type ITransform = (output: rollup.OutputChunk) => Promise<void>;
export type IResolveDependence = (
  id: string
) => Promise<[string, string] | undefined>;

interface INodeModuleOptions {
  name: string;
  outDir: string;
  version: string;
}

export abstract class NodeModule {
  abstract kind: ENodeModuleKind;

  readonly name: string;
  readonly outDir: string;
  readonly dependencies: Map<string, string> = new Map();
  readonly outputs: (rollup.OutputChunk | rollup.OutputAsset)[] = [];
  readonly version: string;

  constructor(options: INodeModuleOptions) {
    const { name, outDir, version } = options;
    this.name = name;
    this.outDir = outDir;
    this.version = version;
  }

  async transformOutput(transform: ITransform) {
    await Promise.all(this.getChunkOutputs().map(_.unary(transform)));
  }

  async resolveDependencies(resolveDependence: IResolveDependence) {
    await Promise.all(
      this.getChunkOutputs()
        .map(async (x) => {
          return x.imports.map(async (id) => {
            const [name, version] = (await resolveDependence(id)) ?? [];
            name && version && this.dependencies.set(name, version);
          });
        })
        .flat()
    );
  }

  async writeFiles({
    cwd,
    prefixedAssetsModuleName,
    writeDts,
  }: {
    cwd: string;
    prefixedAssetsModuleName: string;
    writeDts: boolean;
  }) {
    // write package json
    const packageJsonToWrite = {
      name: this.name,
      version: this.version,
      type: "module",
      sideEffects: false,
      dependencies: _.fromPairs([...this.dependencies.entries()]),
    };

    await fsx.ensureDir(this.outDir);
    await fsx.writeFile(
      join(this.outDir, "package.json"),
      JSON.stringify(packageJsonToWrite, null, 2)
    );

    // write readme
    // 这里是用到了 Rollup 的 output 对象提供的一些信息，比如导出变量
    const readmePath = path.join(this.outDir, "README.md");
    let readmeContent = dedent`
    # ${this.name}

    ## Installation

    npm
    
    \`\`\`bash
    npm i ${this.name}
    \`\`\`

    pnpm

    \`\`\`bash
    pnpm i ${this.name}
    \`\`\`

    yarn

    \`\`\`bash
    yarn add ${this.name}
    \`\`\`

    `;
    if (
      this.kind === ENodeModuleKind.Shared &&
      this.outputs[0]?.type === "chunk"
    ) {
      const outputChunk = this.outputs[0];
      readmeContent += dedent`
      
      ## Usage

      \`\`\`ts
      import { 
        ${
          outputChunk.exports
            .map((x) => (x === "default" ? `default as defaultExport` : x))
            .join(",\n") ?? ""
        }
      } from '${this.name}';
      \`\`\`
      `;
    }

    await fsx.writeFile(readmePath, readmeContent);

    if (!writeDts || !this.isShared() || !(this.outputs[0]?.type === "chunk")) {
      return;
    }

    // write index.d.ts
    // 因为 dts 文件被打包到 assets 模块当中了，所以需要额外生成，
    // 因为 dts 文件生成的结构是保留源代码目录结构的，所以我们可以利用当前模块的源码文件相对于 src 的路径来拼凑出一个指向 assets 模块里的文件
    const outputChunk = this.outputs[0];

    const relativePath = path.relative(
      path.join(cwd, "src"),
      this.asShared().sourceFilePath
    );
    const dtsContent = dedent`
    export * from "${prefixedAssetsModuleName}/types/${relativePath.replace(
      path.extname(relativePath),
      ""
    )}";
    ${
      outputChunk.exports.includes("default")
        ? `export {default} from "${prefixedAssetsModuleName}/types/${relativePath.replace(
            path.extname(relativePath),
            ""
          )}";`
        : ""
    }
    `;
    await fsx.ensureDir(this.outDir);
    await fsx.writeFile(join(this.outDir, "index.d.ts"), dtsContent);
  }

  getChunkOutputs() {
    return this.outputs.filter(
      (x) => x.type === "chunk"
    ) as rollup.OutputChunk[];
  }

  isShared() {
    return this instanceof SharedNodeModule;
  }

  asShared() {
    return this as unknown as SharedNodeModule;
  }

  isChunks() {
    return this instanceof ChunksNodeModule;
  }

  asChunks() {
    return this as unknown as ChunksNodeModule;
  }

  isAssets() {
    return this instanceof AssetsNodeModule;
  }

  asAssets() {
    return this as unknown as AssetsNodeModule;
  }
}

interface ISharedNodeModuleOptions extends INodeModuleOptions {
  sourceFilePath: string;
}

/**
 * 共享模块
 */
export class SharedNodeModule extends NodeModule {
  readonly kind: ENodeModuleKind.Shared = ENodeModuleKind.Shared;

  readonly sourceFilePath: string;

  constructor(options: ISharedNodeModuleOptions) {
    super(options);
    this.sourceFilePath = options.sourceFilePath;
  }
}

/**
 * chunks 模块，打包时多个共享模块可能依赖同一份文件，Rollup 会将他们提取出来，这个模块就是包含了这些的
 */
export class ChunksNodeModule extends NodeModule {
  readonly kind: ENodeModuleKind.Chunks = ENodeModuleKind.Chunks;
}

/**
 * 资产模块，比如 d.ts 文件会存放到这里
 */
export class AssetsNodeModule extends NodeModule {
  readonly kind: ENodeModuleKind.Assets = ENodeModuleKind.Assets;
}

interface IAllSharedNodeModuleOptions extends INodeModuleOptions {
  nodeModuleMap: NodeModuleMap;
  formatDirname: (sharedName: string) => string;
}

/**
 * 所有共享模块的汇聚模块，可以把它当成一个从当前应用抽离出来的组件库，它不参与 Rollup 构建，输出文件需要我们自己来写入
 */
export class AllSharedNodeModule extends NodeModule {
  readonly kind: ENodeModuleKind.AllShared = ENodeModuleKind.AllShared;
  nodeModuleMap: NodeModuleMap;
  formatDirname: (sharedName: string) => string;

  constructor(options: IAllSharedNodeModuleOptions) {
    super(options);
    this.nodeModuleMap = options.nodeModuleMap;
    this.formatDirname = options.formatDirname;
  }

  /**
   * 遍历每个共享模块来生成一个文件夹，然后创建一个入口文件导出共享模块里的所有内容
   */
  async writeFiles() {
    const tasks = this.nodeModuleMap
      .filterSharedModules()
      .map(async ([name, module]) => {
        // 因为在 Rollup 配置项中，我们只指定了一个 output 选项，所以这里每个入口模块最后打包出来 OutputChunk 只有一个
        invariant(
          module.outputs.length === 1 && module.outputs[0].type === "chunk",
          `Shared node module's output maybe wrong.`
        );

        // js
        const hasDefaultExport = module.outputs[0].exports.includes("default");
        const jsFilePath = path.join(
          this.outDir,
          this.formatDirname(name),
          "index.js"
        );
        const jsContent = dedent`
          export * from "${name}";
          ${hasDefaultExport ? `export { default } from "${name}";` : ""}
        `;
        await fsx.ensureFile(jsFilePath);
        await fsx.writeFile(jsFilePath, jsContent);

        // dts
        const dtsFilePath = path.join(
          this.outDir,
          this.formatDirname(name),
          "index.d.ts"
        );
        const dtsContent = dedent`
          export * from "${name}";
          ${hasDefaultExport ? `export { default } from "${name}";` : ""}
        `;
        await fsx.ensureFile(dtsFilePath);
        await fsx.writeFile(dtsFilePath, dtsContent);
      });
    await Promise.all(tasks);

    // package.json
    const packageJson = {
      name: this.name,
      version: this.version,
      type: "module",
      // 由于我们在代码里用到了共享模块，所以将这些共享模块设置成依赖项
      dependencies: this.nodeModuleMap.getDependenciesFromSharedModules(),
    };
    await fsx.writeJson(join(this.outDir, "package.json"), packageJson, {
      spaces: 2,
    });
  }
}
