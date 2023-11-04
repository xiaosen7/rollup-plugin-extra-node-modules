import * as rollup from 'rollup';
import semver from 'semver';

interface ISharedNodeModulePluginOptions {
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
declare function nodeModulesPlugin(options: ISharedNodeModulePluginOptions): Promise<rollup.Plugin<any>>;

declare function createExternalModulesMatchFn(externalModules: string[]): (id: string) => string | undefined;
declare function replaceImportCodeWithModules(code: string, isExternal: (x: string) => boolean, prefix: string): string;
declare function replaceImportFromCodeWithModules(code: string, isExternal: (x: string) => boolean, prefix: string): string;
declare namespace npmUtils {
    function getLastVersionOfPackage(npmPackage: string): Promise<string>;
    function getNextVersionOfPackage(packageName: string, type: semver.ReleaseType): Promise<string>;
}
declare namespace pathUtils {
    function ensureAbsolute(path: string, cwd?: string): string;
}

interface ISharedNameResolverOptions {
    overrides?: Record<string, string>;
    /**
     * 基于哪一个路径来解析获取模块名称，默认和 cwd 一样
     *
     * @default cwd
     */
    baseDir?: string;
    /**
     * 工作路径
     *
     * @default process.cwd()
     */
    cwd?: string;
    /**
     * 在解析过程中去掉的那部分名称
     *
     * @default
     * ['src', 'pages', 'index']
     */
    ignoreSegments?: string[];
    /**
     * 转换 filename
     *
     * @default x => x
     *
     * @example
     * x => x.replace('.stories', '')
     */
    transformFileName?: (name: string) => string;
    /**
     * 将获取的 segments 转为最终结果
     *
     * @default segments => segments.join('-')
     */
    transform?: (segments: string[]) => string;
    /**
     * 解析到根处的名称
     *
     * @default 'root'
     */
    rootName?: string;
}
/**
 * 在路径中保留有效信息从而获取一个名称
 */
declare class PathToNameResolver {
    private overrideSharedNames;
    private baseDir;
    private cwd;
    private droppableSegments;
    private rootName;
    private transform;
    private transformFileName;
    constructor(options?: ISharedNameResolverOptions);
    resolve(filePath: string): {
        name: string;
        override: boolean;
    };
    resolveIgnoreOverrides(filePath: string): {
        name: string;
        override: boolean;
    };
    private splitToSegments;
}

declare enum ENodeModuleKind {
    Shared = 0,
    Chunks = 1,
    Assets = 2,
    AllShared = 3
}
type ITransform = (output: rollup.OutputChunk) => Promise<void>;
type IResolveDependence = (id: string) => Promise<[string, string] | undefined>;
interface INodeModuleOptions {
    name: string;
    outDir: string;
    version: string;
}
declare abstract class NodeModule {
    abstract kind: ENodeModuleKind;
    readonly name: string;
    readonly outDir: string;
    readonly dependencies: Map<string, string>;
    readonly outputs: (rollup.OutputChunk | rollup.OutputAsset)[];
    readonly version: string;
    constructor(options: INodeModuleOptions);
    transformOutput(transform: ITransform): Promise<void>;
    resolveDependencies(resolveDependence: IResolveDependence): Promise<void>;
    writeFiles({ cwd, prefixedAssetsModuleName, writeDts, }: {
        cwd: string;
        prefixedAssetsModuleName: string;
        writeDts: boolean;
    }): Promise<void>;
    getChunkOutputs(): rollup.OutputChunk[];
    isShared(): boolean;
    asShared(): SharedNodeModule;
    isChunks(): boolean;
    asChunks(): ChunksNodeModule;
    isAssets(): boolean;
    asAssets(): AssetsNodeModule;
}
interface ISharedNodeModuleOptions extends INodeModuleOptions {
    sourceFilePath: string;
}
/**
 * 共享模块
 */
declare class SharedNodeModule extends NodeModule {
    readonly kind: ENodeModuleKind.Shared;
    readonly sourceFilePath: string;
    constructor(options: ISharedNodeModuleOptions);
}
/**
 * chunks 模块，打包时多个共享模块可能依赖同一份文件，Rollup 会将他们提取出来，这个模块就是包含了这些的
 */
declare class ChunksNodeModule extends NodeModule {
    readonly kind: ENodeModuleKind.Chunks;
}
/**
 * 资产模块，比如 d.ts 文件会存放到这里
 */
declare class AssetsNodeModule extends NodeModule {
    readonly kind: ENodeModuleKind.Assets;
}

/**
 * 一个 map，打包结束后这里面每一项最后都会生成一个 npm 模块文件夹
 */
declare class NodeModuleMap extends Map</** 模块名称 */ string, NodeModule> {
    /**
     * 创建一个 NodeModuleMap 对象，并使用 input 来初始化共享模块
     * @param input
     * @param cwd
     * @param outDir
     * @param resolveSourcePathToSharedName
     * @returns
     */
    static create(input: string[], cwd: string, outDir: string, resolveSourcePathToSharedName: (x: string) => string): Promise<NodeModuleMap>;
    constructor();
    set(k: string, v: NodeModule): this;
    toArray(): [string, NodeModule][];
    filterSharedModules(): [string, SharedNodeModule][];
    getDependenciesFromSharedModules(): Record<string, string>;
    transformOutput(transform: ITransform): Promise<void>;
    resolveDependencies(packageJson: any): Promise<void>;
    writeNodeModuleFiles(options: {
        cwd: string;
        prefixedAssetsModuleName: string;
        writeDts: boolean;
    }): Promise<void>;
    writeSharedModuleJson(outFilePath: string): Promise<void>;
}

declare class RollupHelper {
    private map;
    private npmPrefix;
    constructor(map: NodeModuleMap, npmPrefix: string);
    getInput(): Record<string, string>;
    transformOutput(output: rollup.OutputChunk): Promise<void>;
}

export { ISharedNameResolverOptions, ISharedNodeModulePluginOptions, NodeModuleMap, PathToNameResolver, RollupHelper, createExternalModulesMatchFn, nodeModulesPlugin as default, nodeModulesPlugin, npmUtils, pathUtils, replaceImportCodeWithModules, replaceImportFromCodeWithModules };
