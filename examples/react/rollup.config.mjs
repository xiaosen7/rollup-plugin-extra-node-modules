import * as rollup from "rollup";
import { nodeModulesPlugin } from "rollup-plugin-extra-node-modules";
import typescript from "@rollup/plugin-typescript";
import { join } from "path";
import { readFileSync } from "fs";
import del from "rollup-plugin-delete";

export default rollup.defineConfig({
  output: {
    dir: "dist",
  },
  plugins: [
    nodeModulesPlugin({
      input: ["src/**/*.tsx"],
      outDir: "dist",
      packageJson: JSON.parse(readFileSync("./package.json", "utf-8")),
    }),
    typescript({
      outDir: join("dist", "assets", "types"),
      rootDir: "./src",
    }),
    del({ targets: ["dist"] }),
  ],
});
