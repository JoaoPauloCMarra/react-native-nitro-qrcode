import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Glob } from "bun";

type JsonRecord = Record<string, unknown>;
type DependencyMap = Record<string, string>;

const projectRoot = import.meta.dir + "/..";

function asRecord(value: unknown): JsonRecord {
  return value != null && typeof value === "object"
    ? (value as JsonRecord)
    : {};
}

function asDependencies(value: unknown): DependencyMap {
  const entries = Object.entries(asRecord(value)).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
  return Object.fromEntries(entries);
}

function run(
  command: string[],
  cwd: string,
): { exitCode: number; output: string } {
  const result = Bun.spawnSync(command, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const decoder = new TextDecoder();
  return {
    exitCode: result.exitCode,
    output: `${decoder.decode(result.stdout)}${decoder.decode(result.stderr)}`,
  };
}

async function main(): Promise<void> {
  const packageFiles = Array.from(
    new Glob("packages/*/package.json").scanSync({ cwd: projectRoot }),
  );
  if (packageFiles.length !== 1) {
    throw new Error(
      `Expected one package manifest, found ${packageFiles.length}.`,
    );
  }

  const packageRelativePath = packageFiles[0];
  const packageManifestPath = join(projectRoot, packageRelativePath);
  const packageManifest = JSON.parse(
    await Bun.file(packageManifestPath).text(),
  ) as JsonRecord;
  const packageName = String(packageManifest.name);
  const packageRoot = dirname(packageManifestPath);
  const sourceDirectory = join(packageRoot, "src");
  const sourceEntry = join(sourceDirectory, "index.ts");
  const temporaryRoot = await mkdtemp(join(tmpdir(), "nitro-rn087-types-"));

  try {
    const build = run(["bun", "run", "build"], projectRoot);
    if (build.exitCode !== 0) {
      throw new Error(
        `Package declaration build failed before the RN 0.87 consumer check:\n${build.output}`,
      );
    }

    const declarationEntry = join(
      packageRoot,
      "lib/typescript/commonjs/index.d.ts",
    );
    if (!(await Bun.file(declarationEntry).exists())) {
      throw new Error(`Missing emitted declaration file: ${declarationEntry}`);
    }

    const pack = run(
      [
        "bun",
        "pm",
        "pack",
        "--ignore-scripts",
        "--destination",
        temporaryRoot,
      ],
      packageRoot,
    );
    if (pack.exitCode !== 0) {
      throw new Error(
        `Package declaration artifact failed to pack:\n${pack.output}`,
      );
    }

    const tarballs = Array.from(
      new Glob("*.tgz").scanSync({ cwd: temporaryRoot }),
    );
    if (tarballs.length !== 1) {
      throw new Error(
        `Expected one packed package artifact, found ${tarballs.length}.\n${pack.output}`,
      );
    }
    const packageTarball = join(temporaryRoot, tarballs[0]);

    const consumerEntry = join(temporaryRoot, "consumer.ts");
    const reactNativeShim = join(temporaryRoot, "react-native-shim.d.ts");
    await Bun.write(
      reactNativeShim,
      `import type { ComponentType } from "react";

declare module "react-native" {
  export type HostComponent<P> = ComponentType<P>;
  export type ImageStyle = Record<string, unknown>;
  export type ViewStyle = Record<string, unknown>;
  export type ViewProps = Record<string, unknown>;
  export type StyleProp<T> = T | readonly StyleProp<T>[] | null | false | undefined;
}
`,
    );
    await Bun.write(
      consumerEntry,
      `import {
  getMatrix,
  NitroQRCode,
  QRCode,
  toPngDataUri,
  toSvgString,
  validateOptions,
} from "${packageName}";
import type {
  QRCodeOptions,
  QRCodeProps,
  QRCodeValidationErrorCode,
} from "${packageName}";

const options = {
  value: "https://example.com/typed-consumer",
  size: 244,
} satisfies QRCodeOptions;
const props: QRCodeProps = options;
const validation = validateOptions(options);
const matrix = getMatrix(options);
const png = toPngDataUri(options);
const svg = toSvgString(options);
const component = QRCode;
const api = NitroQRCode;
const errorCode: QRCodeValidationErrorCode = "invalid";

void props;
void validation;
void matrix;
void png;
void svg;
void component;
void api;
void errorCode;

// @ts-expect-error QRCodeOptions must reject non-string payloads.
const invalidOptions: QRCodeOptions = { value: 42 };
// @ts-expect-error QRCodeProps must reject unknown component props.
const invalidProps: QRCodeProps = { value: "payload", unsupported: true };
void invalidOptions;
void invalidProps;
`,
    );

    const dependencies: DependencyMap = {
      ...asDependencies(packageManifest.dependencies),
      ...asDependencies(packageManifest.peerDependencies),
      ...asDependencies(packageManifest.devDependencies),
      "@types/node": "^24.0.0",
      "@types/react": "~19.2.18",
      react: "19.2.3",
      "react-native": "0.87.0",
      "react-native-nitro-modules": "0.37.0",
      typescript: "6.0.3",
      [packageName]: `file:${packageTarball}`,
    };

    await Bun.write(
      join(temporaryRoot, "package.json"),
      JSON.stringify(
        {
          name: `${packageName}-rn087-typecheck`,
          private: true,
          dependencies,
        },
        null,
        2,
      ),
    );
    await Bun.write(
      join(temporaryRoot, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            allowSyntheticDefaultImports: true,
            baseUrl: temporaryRoot,
            esModuleInterop: true,
            ignoreDeprecations: "6.0",
            jsx: "react-native",
            lib: ["ES2020", "DOM"],
            module: "ESNext",
            moduleResolution: "bundler",
            noEmit: true,
            noFallthroughCasesInSwitch: true,
            noImplicitReturns: true,
            noImplicitOverride: true,
            noUncheckedIndexedAccess: true,
            paths: {
              react: [
                join(temporaryRoot, "node_modules/@types/react/index.d.ts"),
              ],
              "react/*": [join(temporaryRoot, "node_modules/@types/react/*")],
              "react-native": [reactNativeShim],
            },
            skipLibCheck: false,
            strict: true,
            target: "ES2020",
            types: ["react"],
          },
          include: ["consumer.ts"],
        },
        null,
        2,
      ),
    );

    const install = run(
      ["bun", "install", "--ignore-scripts", "--no-progress"],
      temporaryRoot,
    );
    if (install.exitCode !== 0) {
      throw new Error(
        `RN 0.87 compatibility dependencies failed to install:\n${install.output}`,
      );
    }

    const typecheck = run(
      ["bun", "x", "tsc", "--noEmit", "-p", "tsconfig.json"],
      temporaryRoot,
    );
    if (typecheck.exitCode !== 0) {
      throw new Error(
        `Packed declaration consumer compatibility failed:\n${typecheck.output}`,
      );
    }

    await Bun.write(
      join(temporaryRoot, "tsconfig.rn087.json"),
      JSON.stringify(
        {
          compilerOptions: {
            allowSyntheticDefaultImports: true,
            baseUrl: temporaryRoot,
            esModuleInterop: true,
            ignoreDeprecations: "6.0",
            jsx: "react-native",
            module: "ESNext",
            moduleResolution: "bundler",
            noEmit: true,
            noFallthroughCasesInSwitch: true,
            noImplicitReturns: true,
            noImplicitOverride: true,
            noUncheckedIndexedAccess: true,
            paths: {
              [packageName]: [sourceEntry],
              [`${packageName}/*`]: [`${sourceDirectory}/*`],
              react: [
                join(temporaryRoot, "node_modules/@types/react/index.d.ts"),
              ],
              "react/*": [join(temporaryRoot, "node_modules/@types/react/*")],
              "react-native": [
                join(
                  temporaryRoot,
                  "node_modules/react-native/types_generated/index.d.ts",
                ),
              ],
              "react-native/*": [
                join(temporaryRoot, "node_modules/react-native/*"),
              ],
            },
            skipLibCheck: true,
            strict: true,
            target: "ES2020",
            types: ["node", "react", "react-native"],
          },
          include: [sourceEntry, `${sourceDirectory}/**/*.d.ts`],
        },
        null,
        2,
      ),
    );

    const sourceTypecheck = run(
      ["bun", "x", "tsc", "--noEmit", "-p", "tsconfig.rn087.json"],
      temporaryRoot,
    );
    if (sourceTypecheck.exitCode !== 0) {
      throw new Error(
        `RN 0.87 source compatibility failed:\n${sourceTypecheck.output}`,
      );
    }

    console.log(
      `${packageName} passes the packed declaration and RN 0.87 TypeScript compatibility checks.`,
    );
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
}

await main();
