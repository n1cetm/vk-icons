import path from "path";
import { readFile, writeFile } from "fs/promises";
import { emptyDir, mkdirSync, pathExistsSync } from "fs-extra";
import camelcase from "camelcase";
import glob from "fast-glob";
import { getPackageInfo } from "local-pkg";
import { format } from "prettier";
import chalk from "chalk";
import { pathSrc } from "./paths";
import type { BuiltInParserName } from "prettier";

const getSvgFiles = async () => {
	const { rootPath } = await getPackageInfo("@vkontakte/icons");
	return glob("**/*.svg", { cwd: rootPath, absolute: true });
};

const convertToNormalMap = async (files) => {
	const result = {};
	for (let file of files) {
		const { filename, folder, componentName } = getName(file);
		if (!result[folder]) result[folder] = [];

		result[folder].push({
			name: filename,
			component: componentName,
			path: file,
			folder,
		});
	}
	return result;
};

const getName = (file: string) => {
	const name = path.basename(file).replace(".svg", "").split("_");
	name.pop();
	if (Number.isInteger(+name[0])) {
		let n = name.shift();
		name.push(n);
	}

	const filename = name.join("_");
	const folder = path.basename(path.dirname(file));
	const componentName = camelcase(filename, { pascalCase: true });

	return {
		filename,
		folder,
		componentName,
	};
};

const formatCode = (code: string, parser: BuiltInParserName = "typescript") =>
	format(code, {
		parser,
		semi: false,
		singleQuote: true,
	});

const generate = async (normal) => {
	for (let folder in normal) {
		generateFolder(folder);
		const files = normal[folder];
		await Promise.all(files.map((entry) => generateComponent(entry)));
	}
};

const generateFolder = (name) => {
	const dirpath = path.resolve(pathSrc, name);
	const isExist = pathExistsSync(dirpath);
	if (!isExist) mkdirSync(dirpath);
};

const generateComponent = async (entry) => {
	const content = await readFile(entry.path, "utf-8");
	const vue = formatCode(
		`
  <template>
  ${content
		.replace('<?xml version="1.0" encoding="UTF-8"?>', "")
		.replace(/(xmlns:xlink)/g, "xmlnsXlink")
		.replace(/(xlink:href)/g, "xlinkHref")}
  </template>
  <script lang="ts">
    import { defineComponent } from 'vue'
    export default defineComponent({
      name: "${entry.component}",
    })
  </script>`,
		"vue"
	);

	writeFile(path.resolve(pathSrc, entry.folder, `${entry.name}.vue`), vue, "utf-8");
};

const generateEntry = async (entries, folder) => {
	const code = formatCode(
		entries
			.map((entry) => {
				return `export { default as ${entry.component} } from './${entry.name}.vue'`;
			})
			.join("\n")
	);
	await writeFile(path.resolve(pathSrc, folder, "index.ts"), code, "utf-8");
};

const generateMainEntry = async (normal) => {
	const folders = [];
	let files = [];
	for (let folder in normal) {
		const _files = normal[folder];
		await generateEntry(_files, folder);
		files = [...files, ..._files];
		folders.push(folder);
	}

	const code = formatCode(
		[
			...folders.map((folder) => {
				return `export * as Icons${folder} from './${folder}'`;
			}),
			...files.map((file) => {
				return `export { default as Icon${file.folder}${file.component} } from './${file.folder}/${file.name}.vue'`;
			}),
		].join("\n")
	);
	await writeFile(path.resolve(pathSrc, "index.ts"), code, "utf-8");
};

const generateOneEntry = async (normal) => {
	let files = [];
	for (let folder in normal) {
		const _files = normal[folder];

		await generateEntry(_files, folder);
		files = [...files, ..._files];
	}

	const code = formatCode(
		files
			.map((file) => {
				return `export { default as Icon${file.folder}${file.component} } from './${file.folder}/${file.name}.vue'`;
			})
			.join("\n")
	);
	await writeFile(path.resolve(pathSrc, "index.ts"), code, "utf-8");
};

(async () => {
	console.info(chalk.blue("generating vue components"));
	await emptyDir(pathSrc);
	const files = await getSvgFiles();
	const normal = await convertToNormalMap(files);

	console.info(chalk.blue("generating vue files"));
	await generate(normal);

	console.info(chalk.blue("generating entry files"));
	await generateMainEntry(normal);

	console.info(chalk.green("generating done"));
})();
