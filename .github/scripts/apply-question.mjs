/**
 * 只有儲存庫擁有者加上「核准」時才執行。
 * 議題內文與留言只在這個程式裡解析，不進 shell。
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  OWNER_LOGIN,
  isRepoOwner,
  parseIssueBody,
  latestOwnerOverride,
  mergeFields,
  validateFields,
  parseEventsSource,
  serializeEvents,
  applyChange,
  resultComment,
  errorComment
} from "./question-bank.mjs";

const EVENTS_PATH = path.join(process.cwd(), "guess", "events.js");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readEvent() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) fail("缺少 GITHUB_EVENT_PATH。");
  return JSON.parse(fs.readFileSync(eventPath, "utf8"));
}

function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "git 失敗").trim());
  }
  return result.stdout || "";
}

async function github(pathname, options) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("缺少 GITHUB_TOKEN。");
  const response = await fetch("https://api.github.com" + pathname, {
    method: options && options.method ? options.method : "GET",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "User-Agent": "east-asia-history-bank",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options && options.body ? { "Content-Type": "application/json" } : {})
    },
    body: options && options.body ? options.body : undefined
  });
  if (response.status === 204) return null;
  const text = await response.text();
  if (!response.ok) throw new Error("GitHub API " + response.status + " " + pathname);
  return text ? JSON.parse(text) : null;
}

async function comment(repo, number, body) {
  await github("/repos/" + repo + "/issues/" + number + "/comments", {
    method: "POST",
    body: JSON.stringify({ body })
  });
}

async function removeLabel(repo, number) {
  const label = encodeURIComponent("核准");
  const response = await fetch("https://api.github.com/repos/" + repo + "/issues/" + number + "/labels/" + label, {
    method: "DELETE",
    headers: {
      Authorization: "Bearer " + process.env.GITHUB_TOKEN,
      Accept: "application/vnd.github+json",
      "User-Agent": "east-asia-history-bank",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  if (!response.ok && response.status !== 404) {
    throw new Error("無法移除核准標籤");
  }
}

async function listComments(repo, number) {
  const comments = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await github("/repos/" + repo + "/issues/" + number + "/comments?per_page=100&page=" + page);
    if (!Array.isArray(batch) || !batch.length) break;
    comments.push(...batch);
    if (batch.length < 100) break;
  }
  return comments;
}

async function main() {
  const event = readEvent();
  if (event.action !== "labeled") return;
  if (!event.label || event.label.name !== "核准") return;

  const repositoryOwner = event.repository && event.repository.owner && event.repository.owner.login;
  const sender = event.sender && event.sender.login;
  if (!isRepoOwner(sender, repositoryOwner)) {
    console.log("忽略：加上核准的不是儲存庫擁有者。");
    return;
  }
  if (!isRepoOwner(OWNER_LOGIN, repositoryOwner)) {
    console.log("忽略：儲存庫擁有者不是預期帳號。");
    return;
  }

  const repo = event.repository && event.repository.full_name;
  const number = event.issue && event.issue.number;
  if (!repo || !Number.isInteger(number) || repo !== repositoryOwner + "/east-asia-history") {
    fail("議題或儲存庫不正確。");
  }

  // 使用加上標籤當下的內文，不重新抓取，避免之後被改掉。
  const body = event.issue.body || "";
  let override = null;
  try {
    const comments = await listComments(repo, number);
    override = latestOwnerOverride(comments, repositoryOwner);
  } catch (err) {
    await comment(repo, number, errorComment("讀取留言失敗，沒有寫入題庫。"));
    await removeLabel(repo, number);
    fail(err.message);
  }

  const fields = mergeFields(parseIssueBody(body), override);
  const record = validateFields(fields);
  if (record.error) {
    await comment(repo, number, errorComment(record.error));
    await removeLabel(repo, number);
    return;
  }

  let source;
  try {
    source = fs.readFileSync(EVENTS_PATH, "utf8");
  } catch (err) {
    await comment(repo, number, errorComment("找不到 guess/events.js。"));
    await removeLabel(repo, number);
    return;
  }

  let events;
  try {
    events = parseEventsSource(source);
  } catch (err) {
    await comment(repo, number, errorComment(err.message));
    await removeLabel(repo, number);
    return;
  }

  const change = applyChange(events, record, number);
  if (change.error) {
    await comment(repo, number, errorComment(change.error));
    await removeLabel(repo, number);
    return;
  }

  const next = serializeEvents(change.events);
  if (next === source) {
    await comment(repo, number, errorComment("內容與題庫裡的這一題相同，沒有另做提交。"));
    await removeLabel(repo, number);
    return;
  }

  fs.writeFileSync(EVENTS_PATH, next);
  try {
    git(["config", "user.name", "github-actions[bot]"]);
    git(["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
    git(["add", "--", "guess/events.js"]);
    const actionLabel = { add: "新增", edit: "修改", delete: "刪除" }[change.action];
    git(["commit", "-m", "題庫核准 #" + number + " " + actionLabel + " " + change.id]);
    git(["push", "origin", "HEAD:main"]);
  } catch (err) {
    await comment(repo, number, errorComment("寫入或推送失敗，題庫沒有更新。" + err.message));
    fail(err.message);
  }

  await comment(repo, number, resultComment(change));
  await github("/repos/" + repo + "/issues/" + number, {
    method: "PATCH",
    body: JSON.stringify({ state: "closed", state_reason: "completed" })
  });
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
