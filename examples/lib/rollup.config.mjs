import * as rollup from "rollup";
import { nodeModulesPlugin } from "rollup-plugin-extra-node-modules";
import typescript from "@rollup/plugin-typescript";
import { join } from "path";
import del from "rollup-plugin-delete";

export default rollup.defineConfig({
  output: {
    dir: "dist",
  },
  plugins: [
    nodeModulesPlugin({
      input: ["src/**/*.ts"],
      outDir: "dist",
      npmPrefix: "@my-lib/",
    }),
    typescript({
      outDir: join("dist", "@my-lib/", "assets", "types"),
      rootDir: "./src",
    }),
    del({ targets: ["dist"] }),
  ],
});
