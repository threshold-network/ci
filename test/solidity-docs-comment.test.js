import { rejects } from "assert"
import { readFileSync } from "fs"
import { runInNewContext } from "vm"
import { expect } from "chai"
import { load } from "js-yaml"

const workflow = load(
  readFileSync(
    new URL("../.github/workflows/reusable-solidity-docs.yml", import.meta.url),
    "utf8"
  )
)
const commentStep = workflow.jobs["docs-generate-html-and-publish"].steps.find(
  (step) => step.uses?.startsWith("actions/github-script@")
)
const repo = { owner: "example", repo: "contracts" }
const bot = { login: "github-actions[bot]", type: "Bot" }
const rootMarker = "<!-- solidity-docs-preview:. -->"

// Execute the shipped inline script: reusable workflows check out the caller's
// repository, so they cannot depend on a local helper from this repository.
function postPreview(github, { projectDir = "", runId = 200 } = {}) {
  return runInNewContext(`(async () => {\n${commentStep.with.script}\n})()`, {
    github,
    context: {
      repo,
      issue: { number: 42 },
      runId,
      serverUrl: "https://github.com",
    },
    process: { env: { SOLIDITY_DOCS_PROJECT_DIR: projectDir } },
  })
}

function mockGitHub(initialComments = []) {
  const comments = initialComments.map((comment) => ({ ...comment }))
  const calls = { list: [], create: [], update: [] }
  const issues = {
    async listComments(params) {
      calls.list.push(params)
      const { page = 1, per_page: perPage = 30 } = params
      return { data: comments.slice((page - 1) * perPage, page * perPage) }
    },
    async createComment(params) {
      calls.create.push(params)
      const comment = {
        id: comments.length + 1000,
        user: bot,
        body: params.body,
      }
      comments.push(comment)
      return { data: comment }
    },
    async updateComment(params) {
      calls.update.push(params)
      const comment = comments.find(({ id }) => id === params.comment_id)
      comment.body = params.body
      return { data: comment }
    },
  }
  const github = {
    rest: { issues },
    async paginate(method, params) {
      expect(method).to.equal(issues.listComments)
      const result = []
      for (let page = 1; ; page += 1) {
        const { data } = await method({ ...params, page })
        result.push(...data)
        if (data.length < (params.per_page || 30)) return result
      }
    },
  }
  return { github, comments, calls }
}

describe("Solidity docs preview comments", () => {
  it("keeps commenting opt-in and passes the project as data", () => {
    expect(workflow.on.workflow_call.inputs.commentPR.default).to.be.false
    expect(commentStep.if).to.include("inputs.exportAsGHArtifacts == true")
    expect(commentStep.if).to.include("inputs.commentPR == true")
    expect(commentStep.if).to.include("startsWith(github.ref, 'refs/pull')")
    expect(commentStep.env.SOLIDITY_DOCS_PROJECT_DIR).to.equal(
      "${{ inputs.projectDir }}"
    )
    expect(commentStep.with.script).not.to.include("${{")
  })

  it("creates the first preview comment with a stable project marker", async () => {
    const { github, calls } = mockGitHub()

    await postPreview(github)

    expect(calls.create).to.deep.equal([
      {
        ...repo,
        issue_number: 42,
        body: `${rootMarker}\nSolidity API documentation preview available in the artifacts of the https://github.com/example/contracts/actions/runs/200 check.`,
      },
    ])
    expect(calls.update).to.be.empty
  })

  it("updates the workflow-owned comment to point to the latest run", async () => {
    const { github, comments, calls } = mockGitHub()
    await postPreview(github, { runId: 100 })
    const originalId = comments[0].id

    await postPreview(github, { runId: 201 })

    expect(calls.create).to.have.lengthOf(1)
    expect(calls.update).to.deep.equal([
      { ...repo, comment_id: originalId, body: comments[0].body },
    ])
    expect(comments).to.have.lengthOf(1)
    expect(comments[0].body).to.include(rootMarker)
    expect(comments[0].body).to.include("/actions/runs/201")
    expect(comments[0].body).not.to.include("/actions/runs/100")
  })

  it("maintains separate comments for the root and multiple subprojects", async () => {
    const { github, comments, calls } = mockGitHub()
    await postPreview(github, { projectDir: "", runId: 100 })
    await postPreview(github, { projectDir: "/v1/solidity", runId: 101 })
    await postPreview(github, { projectDir: "/v2/solidity", runId: 102 })
    const originalBodies = comments.map(({ body }) => body)

    await postPreview(github, { projectDir: "/v1/solidity", runId: 203 })

    expect(calls.create).to.have.lengthOf(3)
    expect(calls.update).to.have.lengthOf(1)
    expect(calls.update[0].comment_id).to.equal(comments[1].id)
    expect(comments[0].body).to.equal(originalBodies[0])
    expect(comments[2].body).to.equal(originalBodies[2])
    expect(comments[1].body).to.include("/actions/runs/203")
    expect(
      new Set(comments.map(({ body }) => body.split("\n")[0])).size
    ).to.equal(3)
  })

  it("does not edit matching comments from other users or bots", async () => {
    const initialComments = [
      { id: 1, user: { login: "contributor", type: "User" } },
      { id: 2, user: { login: "another-app[bot]", type: "Bot" } },
      { id: 3, user: null },
    ].map((comment) => ({ ...comment, body: `${rootMarker}\nCopied preview` }))
    const { github, comments, calls } = mockGitHub(initialComments)

    await postPreview(github)

    expect(calls.update).to.be.empty
    expect(calls.create).to.have.lengthOf(1)
    expect(comments.slice(0, 3)).to.deep.equal(initialComments)

    await postPreview(github, { runId: 201 })

    expect(calls.create).to.have.lengthOf(1)
    expect(calls.update[0].comment_id).to.equal(comments[3].id)
    expect(comments.slice(0, 3)).to.deep.equal(initialComments)
  })

  it("leaves unmarked, quoted, and empty workflow comments unchanged", async () => {
    const initialComments = [
      {
        id: 1,
        user: bot,
        body: "Solidity API documentation preview available",
      },
      { id: 2, user: bot, body: `Quoted comment:\n${rootMarker}\nPreview` },
      { id: 3, user: bot, body: null },
    ]
    const { github, comments, calls } = mockGitHub(initialComments)

    await postPreview(github)

    expect(calls.update).to.be.empty
    expect(calls.create).to.have.lengthOf(1)
    expect(comments.slice(0, 3)).to.deep.equal(initialComments)
  })

  it("finds an existing preview after the first page of comments", async () => {
    const initialComments = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      user: bot,
      body: "Unrelated workflow comment",
    }))
    initialComments.push({
      id: 101,
      user: bot,
      body: `${rootMarker}\nOld preview`,
    })
    const { github, calls } = mockGitHub(initialComments)

    await postPreview(github)

    expect(calls.list).to.deep.equal([
      { ...repo, issue_number: 42, per_page: 100, page: 1 },
      { ...repo, issue_number: 42, per_page: 100, page: 2 },
    ])
    expect(calls.create).to.be.empty
    expect(calls.update[0].comment_id).to.equal(101)
  })

  it("safely encodes project names containing quotes and comment delimiters", async () => {
    const { github, comments, calls } = mockGitHub()
    const projectDir = "/contracts/\"' -->\n${{ example }}"

    await postPreview(github, { projectDir })
    await postPreview(github, { projectDir, runId: 201 })

    expect(calls.create).to.have.lengthOf(1)
    expect(calls.update).to.have.lengthOf(1)
    const marker = comments[0].body.split("\n")[0]
    expect(marker).to.include("%2Fcontracts%2F")
    expect(marker).to.include("%3E%0A")
    expect(marker.match(/-->/g)).to.have.lengthOf(1)
  })

  it("propagates listing failures without creating a duplicate", async () => {
    const { github, calls } = mockGitHub()
    github.rest.issues.listComments = async () => {
      throw new Error("listing failed")
    }

    await rejects(() => postPreview(github), /listing failed/)

    expect(calls.create).to.be.empty
    expect(calls.update).to.be.empty
  })
})
