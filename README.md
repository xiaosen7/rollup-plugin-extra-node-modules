# rollup-plugin-extra-node-modules

A Rollup plugin to extra node modules from your project.

Now this plugin only supports bundle esm format.

## Usage

```js
import * as rollup from "rollup";
import { nodeModulesPlugin } from "rollup-plugin-extra-node-modules";
import typescript from "@rollup/plugin-typescript"; // or other plugin to bundle typescript
import { join } from "path";

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
  ],
});
```