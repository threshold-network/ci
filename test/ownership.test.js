import { expect } from "chai";
import { createRequire } from "node:module";
import nock from "nock";
import { config, Module } from "../lib/index.js";
const require = createRequire(import.meta.url);
const {
  notifyReleaseManager,
} = require("../actions/notify-workflow-completed/src/notify.js");
const { invoke } = require("../actions/run-workflow/src/invoke.js");

describe("Threshold dispatch ownership", () => {
  let token;
  before(() => {
    token = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "test-token";
    nock.disableNetConnect();
  });
  afterEach(() => {
    expect(nock.pendingMocks()).to.deep.equal([]);
    nock.cleanAll();
  });
  after(() => {
    nock.enableNetConnect();
    if (token === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = token;
  });
  it("only configures current Threshold workflows", () => {
    expect(Object.keys(config.modules)).to.have.length(5);
    for (const id of Object.keys(config.modules))
      expect(new Module(id).owner).to.equal("threshold-network");
  });
  it("notifies the Threshold release manager with the accumulated build payload", async () => {
    let body;
    nock("https://api.github.com")
      .post(
        "/repos/threshold-network/ci/actions/workflows/main.yml/dispatches",
        (value) => {
          body = value;
          return true;
        }
      )
      .reply(204);
    const module = "github.com/threshold-network/keep-core/ecdsa";
    const builds = JSON.parse(
      await notifyReleaseManager(
        module,
        "https://example.com/run",
        "sepolia",
        "[]",
        "main",
        "2.1.0-dev.1"
      )
    );
    expect(builds[0].module).to.equal(module);
    expect(JSON.parse(body.inputs.upstream_builds)).to.deep.equal(builds);
    expect(body.ref).to.equal("main");
  });
  it("awaits downstream dispatch and propagates its failure", async () => {
    nock("https://api.github.com")
      .post(
        "/repos/threshold-network/keep-core/actions/workflows/contracts-random-beacon.yml/dispatches"
      )
      .delay(20)
      .reply(403, { message: "denied" });
    let error;
    try {
      await invoke(
        "sepolia",
        JSON.stringify([
          { module: config.defaultModuleID, version: "1.3.0-dev.1" },
        ]),
        "main"
      );
    } catch (caught) {
      error = caught;
    }
    expect(error).to.be.instanceOf(Error);
    expect(error.message).to.include("denied");
  });
  it("wires the current Threshold module dependency chain in order", () => {
    const chain = [
      "github.com/threshold-network/solidity-contracts",
      "github.com/threshold-network/keep-core/random-beacon",
      "github.com/threshold-network/keep-core/ecdsa",
      "github.com/threshold-network/tbtc-v2",
      "github.com/threshold-network/keep-core/client",
    ];
    const workflows = [
      "contracts.yml",
      "contracts-random-beacon.yml",
      "contracts-ecdsa.yml",
      "contracts.yml",
      "client.yml",
    ];

    expect(config.defaultModuleID).to.equal(chain[0]);

    for (const [index, moduleID] of chain.entries()) {
      const moduleConfig = config.getModuleConfig(moduleID);
      expect(moduleConfig.workflow).to.equal(workflows[index]);
      const expectedDownstream =
        index === chain.length - 1 ? [] : [chain[index + 1]];
      expect(moduleConfig.downstream).to.deep.equal(expectedDownstream);
    }

    const droppedDestinations = [
      "coverage-pools",
      "token-dashboard",
      "arbitrum",
    ];
    for (const [id, moduleConfig] of Object.entries(config.modules)) {
      for (const dropped of droppedDestinations) {
        expect(id).to.not.include(dropped);
        for (const downstreamID of moduleConfig.downstream)
          expect(downstreamID).to.not.include(dropped);
      }
    }
  });
  it("dispatches the entry-point module with a literal ref and the upstream_ref passthrough for a fresh release", async () => {
    let body;
    nock("https://api.github.com")
      .post(
        "/repos/threshold-network/solidity-contracts/actions/workflows/contracts.yml/dispatches",
        (value) => {
          body = value;
          return true;
        }
      )
      .reply(204);

    await invoke("sepolia", "", "main");

    expect(body.ref).to.equal("main");
    expect(body.inputs.upstream_ref).to.equal("main");
  });
});
