import path from "path";
import { rollup } from "rollup";
import chalk from "chalk";
import esbuild from "rollup-plugin-esbuild";
import vue from "@vitejs/plugin-vue";
import { emptyDir } from "fs-extra";
import { pathOutput, pathSrc } from "./paths";

const build = async () => {
	const bundle = await rollup({
		input: [path.resolve(pathSrc, "index.ts")],
		plugins: [
			vue(),
			esbuild({
				target: "es2018",
			}),
		],
		external: ["vue"],
	});
	await Promise.all([
		bundle.write({
			format: "es",
			dir: path.resolve(pathOutput),
			preserveModules: true,
			entryFileNames: "[name].mjs",
		}),
		bundle.write({
			format: "cjs",
			dir: path.resolve(pathOutput),
			preserveModules: true,
			exports: "named",
		}),
		bundle.write({
			format: "umd",
			file: path.resolve(pathOutput, "index.umd.js"),
			name: "VKIconsVue",
			globals: { vue: "Vue" },
		}),
	]);
};

(async () => {
	console.info(chalk.blue("cleaning dist..."));
	await emptyDir(pathOutput);
	console.info(chalk.blue("building..."));
	await build();
	console.info(chalk.green("building done!"));

})();
