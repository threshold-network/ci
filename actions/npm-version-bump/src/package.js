import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

import { Version } from "./version.js";

class Package {
  constructor(name, versionString, filePath) {
    this.name = name;
    this.version = new Version(versionString);
    this.filePath = filePath;
  }

  static fromJSON(json) {
    const { name, version } = JSON.parse(json);

    return new Package(name, version);
  }

  static fromFile(filePath) {
    console.log(`loading package configuration from file: ${filePath}`);

    const packageJsonContent = readFileSync(filePath);

    const newPackage = this.fromJSON(packageJsonContent);

    newPackage.filePath = resolve(filePath);

    return newPackage;
  }

  /**
   *
   * @param {Version} newVersion
   */
  storeVersionInFile(newVersion) {
    if (!this.filePath) {
      throw new Error(`file path not defined`);
    }

    this.version =
      newVersion instanceof Version ? newVersion : new Version(String(newVersion));

    const packageJsonContent = readFileSync(this.filePath);
    const pacakgeJson = JSON.parse(packageJsonContent);

    pacakgeJson.version = this.version.toString();

    writeFileSync(this.filePath, JSON.stringify(pacakgeJson, null, 2));

    console.log(`updated file ${this.filePath}`);
  }
}

export { Package };
