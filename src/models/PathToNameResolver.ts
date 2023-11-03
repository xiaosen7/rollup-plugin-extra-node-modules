import path, { join } from "path";

import { pathUtils } from "../utils";
import normalizePath from "normalize-path";

export interface ISharedNameResolverOptions {
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
export class PathToNameResolver {
  private overrideSharedNames: Record<string, string>;
  private baseDir: string;
  private cwd: string;
  private droppableSegments: string[];
  private rootName: string;
  private transform: (segments: string[]) => string;
  private transformFileName: (name: string) => string;

  constructor(options: ISharedNameResolverOptions = {}) {
    const {
      overrides: overrideSharedNames = {},
      cwd = process.cwd(),
      baseDir = cwd,
      ignoreSegments: droppableSegments = ["src", "pages", "index"],
      rootName = "root",
      transform = (x) => x.join("-"),
      transformFileName = (x) => x,
    } = options;
    this.baseDir = baseDir;
    this.overrideSharedNames = overrideSharedNames;
    this.cwd = cwd;
    this.droppableSegments = droppableSegments;
    this.rootName = rootName;
    this.transform = transform;
    this.transformFileName = transformFileName;
  }

  resolve(filePath: string) {
    const absolute: string = pathUtils.ensureAbsolute(filePath, this.cwd);
    if (this.overrideSharedNames[absolute]) {
      return {
        name: this.transform([this.overrideSharedNames[absolute]]),
        override: true,
      };
    }

    return this.resolveIgnoreOverrides(filePath);
  }

  resolveIgnoreOverrides(filePath: string) {
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
        override: false,
      };
    }

    return {
      name: this.transform(segments),
      override: false,
    };
  }

  private splitToSegments(relativePath: string) {
    const { dir, name } = path.parse(relativePath);

    return normalizePath(join(dir, this.transformFileName(name)))
      .split("/")
      .filter((x) => !this.droppableSegments.includes(x));
  }
}
