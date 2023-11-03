import invariant from "invariant";

import {
  replaceImportCodeWithModules,
  replaceImportFromCodeWithModules,
} from "../utils";

import type { NodeModuleMap } from "./NodeModuleMap";
import type * as rollup from "rollup";

export class RollupHelper {
  constructor(private map: NodeModuleMap, private npmPrefix: string) {}

  getInput() {
    return this.map.toArray().reduce((acc, [sharedName, nodeModule]) => {
      if (nodeModule.isShared()) {
        acc[sharedName] = nodeModule.asShared().sourceFilePath;
      }

      return acc;
    }, {} as Record<string, string>);
  }

  async transformOutput(output: rollup.OutputChunk) {
    const isSharedModule = (x: string) => {
      invariant(
        this.map.has(`${this.npmPrefix}${x}`),
        `${x} 应该包含在 node modules map 当中`
      );
      return true;
    };
    let transformed = output.code;
    // ../y/add.js => @app-xxx/y/add.js
    transformed = replaceImportCodeWithModules(
      transformed,
      isSharedModule,
      this.npmPrefix
    );
    transformed = replaceImportFromCodeWithModules(
      transformed,
      isSharedModule,
      this.npmPrefix
    );
    output.code = transformed;
  }
}
