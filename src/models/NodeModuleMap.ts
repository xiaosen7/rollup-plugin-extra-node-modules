import { join } from "path";

import { npmUtils } from "../utils";
import fg from "fast-glob";
import fsx from "fs-extra";
import invariant from "invariant";
import _ from "lodash";

import { createExternalModulesMatchFn } from "../utils";

import { ENodeModuleKind, SharedNodeModule } from "./NodeModule";

import type { ITransform, NodeModule } from "./NodeModule";

/**
 * 一个 map，打包结束后这里面每一项最后都会生成一个 npm 模块文件夹
 */
export class NodeModuleMap extends Map</** 模块名称 */ string, NodeModule> {
  /**
   * 创建一个 NodeModuleMap 对象，并使用 input 来初始化共享模块
   * @param input
   * @param cwd
   * @param outDir
   * @param resolveSourcePathToSharedName
   * @returns
   */
  static async create(
    input: string[],
    cwd: string,
    outDir: string,
    resolveSourcePathToSharedName: (x: string) => string
  ) {
    const map = new NodeModuleMap();
    const inputFiles = await fg(input, { absolute: true, cwd });

    await Promise.all(
      inputFiles.map(async (filePath) => {
        const sharedName = resolveSourcePathToSharedName(filePath);
        map.set(
          sharedName,
          new SharedNodeModule({
            name: sharedName,
            sourceFilePath: filePath,
            outDir: join(outDir, sharedName),
            version: await npmUtils.getNextVersionOfPackage(
              sharedName,
              "major"
            ),
          })
        );
      })
    );

    return map;
  }

  constructor() {
    super();
  }

  set(k: string, v: NodeModule) {
    invariant(!this.has(k), `Can't set shared name \`${k}\` twice.`);
    return super.set(k, v);
  }

  toArray() {
    return Array.from(this.entries());
  }

  filterSharedModules() {
    return this.toArray().filter(
      (x) => x[1].kind === ENodeModuleKind.Shared
    ) as [string, SharedNodeModule][];
  }

  getDependenciesFromSharedModules() {
    const ret: Record<string, string> = {};
    this.filterSharedModules().forEach(([name, nodeModule]) => {
      ret[name] = nodeModule.version;
    });
    return ret;
  }

  async transformOutput(transform: ITransform) {
    await Promise.all(
      this.toArray().map(([_, module]) => module.transformOutput(transform))
    );
  }

  async resolveDependencies(packageJson: any) {
    const packageJsonDependencies = packageJson.dependencies ?? {};
    const packageJsonPeerDependencies = packageJson.peerDependencies ?? {};
    const externals = [
      ...Object.keys(packageJsonDependencies),
      ...Object.keys(packageJsonPeerDependencies),
      ...this.keys(),
    ];
    const matchExternal = createExternalModulesMatchFn(externals);

    /**
     * 通过传入导入路径来获得三方模块及其版本号
     * @param id
     * @returns
     */
    const resolveDependence = async (id: string) => {
      const name = matchExternal(id);
      if (!name) {
        return;
      }

      let version: string | undefined;
      if (packageJson?.dependencies?.[name]) {
        version = packageJson.dependencies[name];
      } else if (packageJson?.peerDependencies?.[name]) {
        version = packageJson.peerDependencies[name];
      } else {
        version = this.get(name)?.version;
      }

      invariant(version, `Can't get version of ${name}`);
      return [name, version] as [string, string];
    };
    await Promise.all(
      this.toArray().map(([_, module]) =>
        module.resolveDependencies(resolveDependence)
      )
    );
  }

  async writeNodeModuleFiles(options: {
    cwd: string;
    prefixedAssetsModuleName: string;
    writeDts: boolean;
  }) {
    // 这里因为共享模块在生成
    await Promise.all(this.toArray().map(([_, x]) => x.writeFiles(options)));
  }

  async writeSharedModuleJson(outFilePath: string) {
    const sharedModules = [...this.values()].map((x) =>
      _.pick(x, ["name", "version"])
    );
    await fsx.writeFile(outFilePath, JSON.stringify(sharedModules, null, 2));
  }
}
