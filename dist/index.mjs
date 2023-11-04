var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve2, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve2(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/plugin.ts
import fs from "fs/promises";
import path3, { join as join4 } from "path";

// src/utils.ts
import semver from "semver";
import invariant from "invariant";
import { isAbsolute, resolve } from "path";
import { command } from "execa";
function createExternalModulesMatchFn(externalModules) {
  const regExps = externalModules.map(
    (module) => new RegExp(`^${module}(\\/.+)*$`)
  );
  return function(id) {
    const index = regExps.findIndex((r) => r.test(id));
    if (index >= 0) {
      return externalModules[index];
    }
  };
}
function replaceImportCodeWithModules(code, isExternal, prefix) {
  return code.replace(/import\s(\"|\')\.\.\/(.*)\//g, (substr, seg, module) => {
    if (isExternal(module)) {
      return `import ${seg}${prefix}${module}/`;
    }
    return substr;
  });
}
function replaceImportFromCodeWithModules(code, isExternal, prefix) {
  return code.replace(/from\s(\"|\')\.\.\/(.*)\//g, (substr, seg, module) => {
    if (isExternal(module)) {
      return `from ${seg}${prefix}${module}/`;
    }
    return substr;
  });
}
var npmUtils;
((npmUtils2) => {
  function getLastVersionOfPackage(npmPackage) {
    return __async(this, null, function* () {
      try {
        const { stdout } = yield command(
          `npm view ${npmPackage} version --registry ${process.env.FETCH_REPOSITORY}`
        );
        return stdout;
      } catch (error) {
        if (error.message.includes("404 Not Found")) {
          return "0.0.0";
        }
        throw error;
      }
    });
  }
  npmUtils2.getLastVersionOfPackage = getLastVersionOfPackage;
  function getNextVersionOfPackage(packageName, type) {
    return __async(this, null, function* () {
      const lastVersion = yield getLastVersionOfPackage(packageName);
      const nextVersion = semver.inc(lastVersion, type);
      invariant(nextVersion, "Next version should not be null.");
      return nextVersion;
    });
  }
  npmUtils2.getNextVersionOfPackage = getNextVersionOfPackage;
})(npmUtils || (npmUtils = {}));
var pathUtils;
((pathUtils2) => {
  function ensureAbsolute(path4, cwd = process.cwd()) {
    if (isAbsolute(path4)) {
      return path4;
    }
    return resolve(cwd, path4);
  }
  pathUtils2.ensureAbsolute = ensureAbsolute;
})(pathUtils || (pathUtils = {}));

// src/plugin.ts
import _3 from "lodash";

// src/models/PathToNameResolver.ts
import path, { join } from "path";
import normalizePath from "normalize-path";
var PathToNameResolver = class {
  constructor(options = {}) {
    const {
      overrides: overrideSharedNames = {},
      cwd = process.cwd(),
      baseDir = cwd,
      ignoreSegments: droppableSegments = ["src", "pages", "index"],
      rootName = "root",
      transform = (x) => x.join("-"),
      transformFileName = (x) => x
    } = options;
    this.baseDir = baseDir;
    this.overrideSharedNames = overrideSharedNames;
    this.cwd = cwd;
    this.droppableSegments = droppableSegments;
    this.rootName = rootName;
    this.transform = transform;
    this.transformFileName = transformFileName;
  }
  resolve(filePath) {
    const absolute = pathUtils.ensureAbsolute(filePath, this.cwd);
    if (this.overrideSharedNames[absolute]) {
      return {
        name: this.transform([this.overrideSharedNames[absolute]]),
        override: true
      };
    }
    return this.resolveIgnoreOverrides(filePath);
  }
  resolveIgnoreOverrides(filePath) {
    const segments = this.splitToSegments(
      normalizePath(
        path.relative(
          this.baseDir,
          pathUtils.ensureAbsolute(filePath, this.cwd)
        )
      )
    );
    if (segments.length === 0) {
      return {
        name: this.rootName,
        override: false
      };
    }
    return {
      name: this.transform(segments),
      override: false
    };
  }
  splitToSegments(relativePath) {
    const { dir, name } = path.parse(relativePath);
    return normalizePath(join(dir, this.transformFileName(name))).split("/").filter((x) => !this.droppableSegments.includes(x));
  }
};

// src/models/RollupHelper.ts
import invariant2 from "invariant";
var RollupHelper = class {
  constructor(map, npmPrefix) {
    this.map = map;
    this.npmPrefix = npmPrefix;
  }
  getInput() {
    return this.map.toArray().reduce((acc, [sharedName, nodeModule]) => {
      if (nodeModule.isShared()) {
        acc[sharedName] = nodeModule.asShared().sourceFilePath;
      }
      return acc;
    }, {});
  }
  transformOutput(output) {
    return __async(this, null, function* () {
      const isSharedModule = (x) => {
        invariant2(
          this.map.has(`${this.npmPrefix}${x}`),
          `${x} \u5E94\u8BE5\u5305\u542B\u5728 node modules map \u5F53\u4E2D`
        );
        return true;
      };
      let transformed = output.code;
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
    });
  }
};

// src/models/NodeModuleMap.ts
import { join as join3 } from "path";
import fg from "fast-glob";
import fsx2 from "fs-extra";
import invariant4 from "invariant";
import _2 from "lodash";

// src/models/NodeModule.ts
import path2, { join as join2 } from "path";
import fsx from "fs-extra";
import invariant3 from "invariant";
import _ from "lodash";
import { dedent } from "ts-dedent";
var NodeModule = class {
  constructor(options) {
    this.dependencies = /* @__PURE__ */ new Map();
    this.outputs = [];
    const { name, outDir, version } = options;
    this.name = name;
    this.outDir = outDir;
    this.version = version;
  }
  transformOutput(transform) {
    return __async(this, null, function* () {
      yield Promise.all(this.getChunkOutputs().map(_.unary(transform)));
    });
  }
  resolveDependencies(resolveDependence) {
    return __async(this, null, function* () {
      yield Promise.all(
        this.getChunkOutputs().map((x) => __async(this, null, function* () {
          return x.imports.map((id) => __async(this, null, function* () {
            var _a;
            const [name, version] = (_a = yield resolveDependence(id)) != null ? _a : [];
            name && version && this.dependencies.set(name, version);
          }));
        })).flat()
      );
    });
  }
  writeFiles(_0) {
    return __async(this, arguments, function* ({
      cwd,
      prefixedAssetsModuleName,
      writeDts
    }) {
      var _a, _b, _c;
      const packageJsonToWrite = {
        name: this.name,
        version: this.version,
        type: "module",
        sideEffects: false,
        dependencies: _.fromPairs([...this.dependencies.entries()])
      };
      yield fsx.ensureDir(this.outDir);
      yield fsx.writeFile(
        join2(this.outDir, "package.json"),
        JSON.stringify(packageJsonToWrite, null, 2)
      );
      const readmePath = path2.join(this.outDir, "README.md");
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
      if (this.kind === 0 /* Shared */ && ((_a = this.outputs[0]) == null ? void 0 : _a.type) === "chunk") {
        const outputChunk2 = this.outputs[0];
        readmeContent += dedent`
      
      ## Usage

      \`\`\`ts
      import { 
        ${(_b = outputChunk2.exports.map((x) => x === "default" ? `default as defaultExport` : x).join(",\n")) != null ? _b : ""}
      } from '${this.name}';
      \`\`\`
      `;
      }
      yield fsx.writeFile(readmePath, readmeContent);
      if (!writeDts || !this.isShared() || !(((_c = this.outputs[0]) == null ? void 0 : _c.type) === "chunk")) {
        return;
      }
      const outputChunk = this.outputs[0];
      const relativePath = path2.relative(
        path2.join(cwd, "src"),
        this.asShared().sourceFilePath
      );
      const dtsContent = dedent`
    export * from "${prefixedAssetsModuleName}/types/${relativePath.replace(
        path2.extname(relativePath),
        ""
      )}";
    ${outputChunk.exports.includes("default") ? `export {default} from "${prefixedAssetsModuleName}/types/${relativePath.replace(
        path2.extname(relativePath),
        ""
      )}";` : ""}
    `;
      yield fsx.ensureDir(this.outDir);
      yield fsx.writeFile(join2(this.outDir, "index.d.ts"), dtsContent);
    });
  }
  getChunkOutputs() {
    return this.outputs.filter(
      (x) => x.type === "chunk"
    );
  }
  isShared() {
    return this instanceof SharedNodeModule;
  }
  asShared() {
    return this;
  }
  isChunks() {
    return this instanceof ChunksNodeModule;
  }
  asChunks() {
    return this;
  }
  isAssets() {
    return this instanceof AssetsNodeModule;
  }
  asAssets() {
    return this;
  }
};
var SharedNodeModule = class extends NodeModule {
  constructor(options) {
    super(options);
    this.kind = 0 /* Shared */;
    this.sourceFilePath = options.sourceFilePath;
  }
};
var ChunksNodeModule = class extends NodeModule {
  constructor() {
    super(...arguments);
    this.kind = 1 /* Chunks */;
  }
};
var AssetsNodeModule = class extends NodeModule {
  constructor() {
    super(...arguments);
    this.kind = 2 /* Assets */;
  }
};
var AllSharedNodeModule = class extends NodeModule {
  constructor(options) {
    super(options);
    this.kind = 3 /* AllShared */;
    this.nodeModuleMap = options.nodeModuleMap;
    this.formatDirname = options.formatDirname;
  }
  /**
   * 遍历每个共享模块来生成一个文件夹，然后创建一个入口文件导出共享模块里的所有内容
   */
  writeFiles() {
    return __async(this, null, function* () {
      const tasks = this.nodeModuleMap.filterSharedModules().map((_0) => __async(this, [_0], function* ([name, module]) {
        invariant3(
          module.outputs.length === 1 && module.outputs[0].type === "chunk",
          `Shared node module's output maybe wrong.`
        );
        const hasDefaultExport = module.outputs[0].exports.includes("default");
        const jsFilePath = path2.join(
          this.outDir,
          this.formatDirname(name),
          "index.js"
        );
        const jsContent = dedent`
          export * from "${name}";
          ${hasDefaultExport ? `export { default } from "${name}";` : ""}
        `;
        yield fsx.ensureFile(jsFilePath);
        yield fsx.writeFile(jsFilePath, jsContent);
        const dtsFilePath = path2.join(
          this.outDir,
          this.formatDirname(name),
          "index.d.ts"
        );
        const dtsContent = dedent`
          export * from "${name}";
          ${hasDefaultExport ? `export { default } from "${name}";` : ""}
        `;
        yield fsx.ensureFile(dtsFilePath);
        yield fsx.writeFile(dtsFilePath, dtsContent);
      }));
      yield Promise.all(tasks);
      const packageJson = {
        name: this.name,
        version: this.version,
        type: "module",
        // 由于我们在代码里用到了共享模块，所以将这些共享模块设置成依赖项
        dependencies: this.nodeModuleMap.getDependenciesFromSharedModules()
      };
      yield fsx.writeJson(join2(this.outDir, "package.json"), packageJson, {
        spaces: 2
      });
    });
  }
};

// src/models/NodeModuleMap.ts
var NodeModuleMap = class _NodeModuleMap extends Map {
  /**
   * 创建一个 NodeModuleMap 对象，并使用 input 来初始化共享模块
   * @param input
   * @param cwd
   * @param outDir
   * @param resolveSourcePathToSharedName
   * @returns
   */
  static create(input, cwd, outDir, resolveSourcePathToSharedName) {
    return __async(this, null, function* () {
      const map = new _NodeModuleMap();
      const inputFiles = yield fg(input, { absolute: true, cwd });
      yield Promise.all(
        inputFiles.map((filePath) => __async(this, null, function* () {
          const sharedName = resolveSourcePathToSharedName(filePath);
          map.set(
            sharedName,
            new SharedNodeModule({
              name: sharedName,
              sourceFilePath: filePath,
              outDir: join3(outDir, sharedName),
              version: yield npmUtils.getNextVersionOfPackage(
                sharedName,
                "major"
              )
            })
          );
        }))
      );
      return map;
    });
  }
  constructor() {
    super();
  }
  set(k, v) {
    invariant4(!this.has(k), `Can't set shared name \`${k}\` twice.`);
    return super.set(k, v);
  }
  toArray() {
    return Array.from(this.entries());
  }
  filterSharedModules() {
    return this.toArray().filter(
      (x) => x[1].kind === 0 /* Shared */
    );
  }
  getDependenciesFromSharedModules() {
    const ret = {};
    this.filterSharedModules().forEach(([name, nodeModule]) => {
      ret[name] = nodeModule.version;
    });
    return ret;
  }
  transformOutput(transform) {
    return __async(this, null, function* () {
      yield Promise.all(
        this.toArray().map(([_4, module]) => module.transformOutput(transform))
      );
    });
  }
  resolveDependencies(packageJson) {
    return __async(this, null, function* () {
      var _a, _b;
      const packageJsonDependencies = (_a = packageJson.dependencies) != null ? _a : {};
      const packageJsonPeerDependencies = (_b = packageJson.peerDependencies) != null ? _b : {};
      const externals = [
        ...Object.keys(packageJsonDependencies),
        ...Object.keys(packageJsonPeerDependencies),
        ...this.keys()
      ];
      const matchExternal = createExternalModulesMatchFn(externals);
      const resolveDependence = (id) => __async(this, null, function* () {
        var _a2, _b2, _c;
        const name = matchExternal(id);
        if (!name) {
          return;
        }
        let version;
        if ((_a2 = packageJson == null ? void 0 : packageJson.dependencies) == null ? void 0 : _a2[name]) {
          version = packageJson.dependencies[name];
        } else if ((_b2 = packageJson == null ? void 0 : packageJson.peerDependencies) == null ? void 0 : _b2[name]) {
          version = packageJson.peerDependencies[name];
        } else {
          version = (_c = this.get(name)) == null ? void 0 : _c.version;
        }
        invariant4(version, `Can't get version of ${name}`);
        return [name, version];
      });
      yield Promise.all(
        this.toArray().map(
          ([_4, module]) => module.resolveDependencies(resolveDependence)
        )
      );
    });
  }
  writeNodeModuleFiles(options) {
    return __async(this, null, function* () {
      yield Promise.all(this.toArray().map(([_4, x]) => x.writeFiles(options)));
    });
  }
  writeSharedModuleJson(outFilePath) {
    return __async(this, null, function* () {
      const sharedModules = [...this.values()].map(
        (x) => _2.pick(x, ["name", "version"])
      );
      yield fsx2.writeFile(outFilePath, JSON.stringify(sharedModules, null, 2));
    });
  }
};

// src/plugin.ts
function nodeModulesPlugin(options) {
  return __async(this, null, function* () {
    const {
      cwd = process.cwd(),
      packageJson = JSON.parse(
        yield fs.readFile(path3.resolve(cwd, "package.json"), "utf-8")
      ),
      npmPrefix = "",
      chunkModuleName = "chunks",
      assetsModuleName = "assets",
      allSharedModuleName = "all-shared",
      overrideNames,
      input,
      outDir = "dist",
      writeDts = true
    } = options;
    const sharedNameResolver = new PathToNameResolver({
      transform: (s) => `${npmPrefix}${_3.kebabCase(s.join(" "))}`,
      overrides: overrideNames
    });
    const nodeModuleMap = yield NodeModuleMap.create(
      input,
      cwd,
      outDir,
      (x) => sharedNameResolver.resolve(x).name
    );
    const rollupHelper = new RollupHelper(nodeModuleMap, npmPrefix);
    const withNpmPrefix = (x) => `${npmPrefix}${x}`;
    const prefixedChunksModuleName = withNpmPrefix(chunkModuleName);
    const prefixedAssetsModuleName = withNpmPrefix(assetsModuleName);
    const prefixedAllSharedModuleName = withNpmPrefix(allSharedModuleName);
    return {
      name: "shared-plugin",
      options(options2) {
        return __spreadProps(__spreadValues({}, options2), {
          input: rollupHelper.getInput()
        });
      },
      /**
       * Rollup 将所有模块都处理完成以后但还未输出之前会进入到这里
       *
       * generateBundle 会在 outputOptions 之前执行
       * @param options
       * @param bundle
       */
      generateBundle(options2, bundle) {
        return __async(this, null, function* () {
          const chunkNodeModule = new ChunksNodeModule({
            name: prefixedChunksModuleName,
            outDir: join4(outDir, prefixedChunksModuleName),
            version: yield npmUtils.getNextVersionOfPackage(
              prefixedChunksModuleName,
              "major"
            )
          });
          nodeModuleMap.set(prefixedChunksModuleName, chunkNodeModule);
          const assetsNodeModule = new AssetsNodeModule({
            name: prefixedAssetsModuleName,
            outDir: join4(outDir, prefixedAssetsModuleName),
            version: yield npmUtils.getNextVersionOfPackage(
              prefixedAssetsModuleName,
              "major"
            )
          });
          nodeModuleMap.set(prefixedAssetsModuleName, assetsNodeModule);
          const allSharedNodeModule = new AllSharedNodeModule({
            name: prefixedAllSharedModuleName,
            nodeModuleMap,
            outDir: join4(outDir, prefixedAllSharedModuleName),
            formatDirname: (x) => x.replace(npmPrefix, ""),
            version: yield npmUtils.getNextVersionOfPackage(
              prefixedAllSharedModuleName,
              "major"
            )
          });
          nodeModuleMap.set(prefixedAllSharedModuleName, allSharedNodeModule);
          Object.values(bundle).forEach((output) => __async(this, null, function* () {
            if (output.type === "asset") {
              nodeModuleMap.get(prefixedAssetsModuleName).outputs.push(output);
            } else if (!output.isEntry) {
              nodeModuleMap.get(prefixedChunksModuleName).outputs.push(output);
            } else {
              nodeModuleMap.get(output.name).outputs.push(output);
            }
          }));
          yield nodeModuleMap.transformOutput(
            (x) => rollupHelper.transformOutput(x)
          );
          yield nodeModuleMap.resolveDependencies(packageJson);
          nodeModuleMap.toArray().forEach(([_4, module]) => {
            if (!module.isAssets()) {
              module.dependencies.set(
                prefixedAssetsModuleName,
                assetsNodeModule.version
              );
            }
          });
          yield nodeModuleMap.writeNodeModuleFiles({
            cwd,
            prefixedAssetsModuleName,
            writeDts
          });
          yield nodeModuleMap.writeSharedModuleJson(
            join4(outDir, "node-modules.json")
          );
        });
      },
      outputOptions(options2) {
        return __spreadProps(__spreadValues({}, options2), {
          chunkFileNames: `${prefixedChunksModuleName}/[name].js`,
          assetFileNames: `${prefixedAssetsModuleName}/[name].js`,
          entryFileNames: "[name]/index.js"
        });
      }
    };
  });
}

// src/index.ts
var src_default = nodeModulesPlugin;
export {
  NodeModuleMap,
  PathToNameResolver,
  RollupHelper,
  createExternalModulesMatchFn,
  src_default as default,
  nodeModulesPlugin,
  npmUtils,
  pathUtils,
  replaceImportCodeWithModules,
  replaceImportFromCodeWithModules
};
//# sourceMappingURL=index.mjs.map