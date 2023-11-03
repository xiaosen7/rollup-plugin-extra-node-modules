import semver from "semver";
import invariant from "invariant";
import { isAbsolute, resolve } from "path";
import { command } from "execa";

export function createExternalModulesMatchFn(externalModules: string[]) {
  /**
   * @see https://github.com/pmowrer/rollup-plugin-peer-deps-external/blob/master/src/get-modules-matcher.js
   */
  const regExps = externalModules.map(
    (module) => new RegExp(`^${module}(\\/\.+)*$`)
  );

  /**
   * @returns return the external module if it matches the id, or undefined
   */
  return function (id: string) {
    const index = regExps.findIndex((r) => r.test(id));
    if (index >= 0) {
      return externalModules[index];
    }
  };
}

export function replaceImportCodeWithModules(
  code: string,
  isExternal: (x: string) => boolean,
  prefix: string
) {
  return code.replace(/import\s(\"|\')\.\.\/(.*)\//g, (substr, seg, module) => {
    if (isExternal(module)) {
      return `import ${seg}${prefix}${module}/`;
    }
    return substr;
  });
}

export function replaceImportFromCodeWithModules(
  code: string,
  isExternal: (x: string) => boolean,
  prefix: string
) {
  return code.replace(/from\s(\"|\')\.\.\/(.*)\//g, (substr, seg, module) => {
    if (isExternal(module)) {
      return `from ${seg}${prefix}${module}/`;
    }
    return substr;
  });
}

export namespace npmUtils {
  export async function getLastVersionOfPackage(npmPackage: string) {
    try {
      const { stdout } = await command(
        `npm view ${npmPackage} version --registry ${process.env.FETCH_REPOSITORY}`
      );
      return stdout;
    } catch (error: any) {
      if (error.message.includes("404 Not Found")) {
        return "0.0.0";
      }

      throw error;
    }
  }

  export async function getNextVersionOfPackage(
    packageName: string,
    type: semver.ReleaseType
  ) {
    const lastVersion = await getLastVersionOfPackage(packageName);
    const nextVersion = semver.inc(lastVersion, type);
    invariant(nextVersion, "Next version should not be null.");
    return nextVersion;
  }
}

export namespace pathUtils {
  export function ensureAbsolute(path: string, cwd: string = process.cwd()) {
    if (isAbsolute(path)) {
      return path;
    }

    return resolve(cwd, path);
  }
}
