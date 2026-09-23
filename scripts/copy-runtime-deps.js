const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const [destination, ...rootPackages] = process.argv.slice(2);
if (!destination || rootPackages.length === 0) {
  throw new Error("Uso: node copy-runtime-deps.js <destino> <paquete...>");
}

const nodeModulesRoot = path.resolve("node_modules");
const visited = new Set();

function findPackageRoot(entryPath, packageName) {
  let current = fs.statSync(entryPath).isDirectory() ? entryPath : path.dirname(entryPath);
  let match = null;
  while (current.startsWith(nodeModulesRoot)) {
    const packageJsonPath = path.join(current, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      if (packageJson.name === packageName) match = { current, packageJson };
    }
    current = path.dirname(current);
  }
  if (match) return match;
  throw new Error(`No se encontró package.json para ${packageName}`);
}

function copyPackage(packageName, resolveFrom) {
  if (packageName.startsWith("@types/")) return;

  const resolver = createRequire(path.join(resolveFrom, "__runtime-deps__.js"));
  for (const searchPath of resolver.resolve.paths(packageName) ?? []) {
    const packageJsonPath = path.join(searchPath, packageName, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const packageRoot = path.dirname(packageJsonPath);
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      return copyResolvedPackage(packageName, packageRoot, packageJson);
    }
  }

  const entryPath = resolver.resolve(packageName);
  const { current: packageRoot, packageJson } = findPackageRoot(entryPath, packageName);
  return copyResolvedPackage(packageName, packageRoot, packageJson);
}

function copyResolvedPackage(packageName, packageRoot, packageJson) {
  const relativePath = path.relative(nodeModulesRoot, packageRoot);
  if (visited.has(relativePath)) return;
  visited.add(relativePath);

  fs.cpSync(packageRoot, path.join(destination, relativePath), {
    recursive: true,
    force: true,
  });

  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.optionalDependencies,
  };
  for (const dependency of Object.keys(dependencies)) {
    try {
      copyPackage(dependency, packageRoot);
    } catch (error) {
      if (!packageJson.optionalDependencies?.[dependency]) throw error;
    }
  }
}

fs.mkdirSync(destination, { recursive: true });
for (const packageName of rootPackages) {
  copyPackage(packageName, nodeModulesRoot);
}
