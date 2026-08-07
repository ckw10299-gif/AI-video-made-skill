const BRIDGE_URL = "http://127.0.0.1:8787";
const POLL_INTERVAL = 1800;
const BRIDGE_VERSION = "0.2.3";
let activeTask = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isVisible(element) {
  if (!(element instanceof HTMLElement)) return false;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

async function waitFor(factory, label, timeout = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = factory();
    if (value) return value;
    await sleep(180);
  }
  throw new Error(`等待超时：${label}`);
}

function exactTextElements(text) {
  return [...document.querySelectorAll("button, [role=button], [role=option], [role=menuitem], li, span, div")]
    .filter((element) => isVisible(element) && element.textContent.trim() === text);
}

function clickableFor(element) {
  return element.closest("button, [role=button], [role=option], [role=menuitem], li") || element;
}

async function clickExactText(text, optional = false) {
  const timeout = optional ? 2500 : 12000;
  const element = await waitFor(() => exactTextElements(text)[0], text, timeout).catch(() => null);
  if (!element) {
    if (optional) return false;
    throw new Error(`找不到控件：${text}`);
  }
  clickableFor(element).click();
  await sleep(350);
  return true;
}

async function patchTask(task, update) {
  await fetch(`${BRIDGE_URL}/api/bridge/tasks/${task.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update)
  });
}

function collectDiagnostics(stage) {
  const editors = [...document.querySelectorAll('.cr-vid-prompt-editor, [contenteditable="true"]')]
    .filter(isVisible)
    .map((element) => ({
      className: element.className,
      text: element.innerText.slice(0, 300),
      html: element.innerHTML.slice(0, 500)
    }));
  const fileInputs = [...document.querySelectorAll('input[type="file"]')].map((input) => ({
    accept: input.accept,
    multiple: input.multiple,
    parentClass: input.parentElement?.className || "",
    uploadClass: input.closest(".el-upload")?.className || ""
  }));
  const imageLabels = [...document.querySelectorAll("span, div")]
    .filter((element) => /^图片\d+$/.test(element.textContent.trim()) && isVisible(element))
    .slice(0, 12)
    .map((element) => ({ text: element.textContent.trim(), className: element.className }));
  return { version: BRIDGE_VERSION, stage, url: location.href, editors, fileInputs, imageLabels };
}

function attachmentCardFor(label) {
  let current = label;
  for (let depth = 0; current && depth < 6; depth += 1, current = current.parentElement) {
    const rect = current.getBoundingClientRect();
    if (rect.width > 35 && rect.width < 240 && rect.height > 35 && rect.height < 240 && current.querySelector("img")) {
      return current;
    }
  }
  return null;
}

async function clearOldAttachments() {
  for (let pass = 0; pass < 12; pass += 1) {
    const label = [...document.querySelectorAll("span, div")]
      .find((element) => /^图片\d+$/.test(element.textContent.trim()) && isVisible(element));
    if (!label) return;
    const card = attachmentCardFor(label);
    const remove = card?.querySelector('button[aria-label*="删除"], button[aria-label*="移除"], button[aria-label*="关闭"], [class*=delete], [class*=remove], [class*=close]');
    if (!remove || !isVisible(remove)) return;
    clickableFor(remove).click();
    await sleep(250);
  }
}

async function clearComposer() {
  const editor = [...document.querySelectorAll('.cr-vid-prompt-editor')].find(isVisible);
  if (editor) await replaceEditorText(editor);
  await clearOldAttachments();
}

async function configurePage(task) {
  await clickExactText(task.config.mode, true);
  await clickExactText(task.config.workspace, true);
  await clickExactText(`${task.config.ratio} · ${task.config.resolution} · ${task.config.duration}s`, true);
}

async function uploadAssets(task) {
  await waitFor(
    () => {
      const inputs = [...document.querySelectorAll('input[type="file"]')];
      return inputs.find((item) => /image|png|jpe?g|webp/i.test(item.accept)) ||
        inputs.find((item) => item.multiple && item.closest(".el-upload")) ||
        inputs.find((item) => item.closest(".el-upload"));
    },
    "素材上传入口"
  );
  for (let index = 0; index < task.assets.length; index += 1) {
    const asset = task.assets[index];
    const response = await chrome.runtime.sendMessage({
      type: "setFileInputFiles",
      paths: [asset.path]
    });
    if (!response?.ok) throw new Error(response?.error || `上传素材失败：${asset.name}`);
    await waitFor(
      () => exactTextElements(asset.mentionLabel).length > 0,
      `上传 ${asset.name}`,
      30000
    );
    await sleep(350);
  }
}

function focusEditor(editor) {
  editor.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(editor);
  selection.removeAllRanges();
  selection.addRange(range);
}

async function replaceEditorText(editor, text = "") {
  focusEditor(editor);
  const response = await chrome.runtime.sendMessage({ type: "replaceEditorText", text });
  if (!response?.ok) throw new Error(response?.error || "清空提示词失败");
  await waitFor(() => editor.innerText.trim() === text.trim(), "清空旧提示词", 4000);
}

async function insertEditorText(editor, text) {
  editor.focus();
  const response = await chrome.runtime.sendMessage({ type: "insertEditorText", text });
  if (!response?.ok) throw new Error(response?.error || "写入提示词失败");
  await sleep(40);
}

function moveCaretToEditorEnd(editor) {
  editor.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function mentionCandidate(label, editor) {
  const editorRect = editor.getBoundingClientRect();
  const candidates = exactTextElements(label).map((element) => {
    const rect = element.getBoundingClientRect();
    const popup = element.closest('[role=listbox], [role=menu], .el-popper, .cr-at-menu, .cr-at-menu-item, [class*=mention], [class*=suggest], [class*=dropdown], [class*=popover]');
    const distance = Math.abs(rect.top - editorRect.bottom) + Math.abs(rect.left - editorRect.left);
    return { element, score: (popup ? -100000 : 0) + distance };
  });
  const popupCandidates = candidates.filter((item) => item.score < 0);
  popupCandidates.sort((a, b) => a.score - b.score);
  if (popupCandidates[0]) return popupCandidates[0].element;

  const cards = exactTextElements(label)
    .map((element) => element.closest(".cr-ref-card"))
    .filter((element, index, all) => element && isVisible(element) && all.indexOf(element) === index);
  return cards.length === 1 ? cards[0] : null;
}

async function insertMention(editor, label) {
  await insertEditorText(editor, "@");
  const candidate = await waitFor(() => mentionCandidate(label, editor), `素材关联 ${label}`, 5000);
  clickableFor(candidate).click();
  await sleep(300);
  await waitFor(
    () => [...editor.querySelectorAll('.cr-inline-mention')]
      .some((element) =>
        (element.dataset.mentionLabel === label || element.textContent.trim() === label) &&
        Boolean(element.dataset.mentionUrl)
      ),
    `确认素材关联 ${label}`,
    5000
  );
  moveCaretToEditorEnd(editor);
}

async function fillPromptWithMentions(task) {
  const editor = await waitFor(
    () => [...document.querySelectorAll('.cr-vid-prompt-editor')].find(isVisible),
    "提示词编辑器"
  );
  await replaceEditorText(editor);
  const marker = /\{\{asset:([^}]+)\}\}/g;
  let cursor = 0;
  let match;
  while ((match = marker.exec(task.prompt))) {
    await insertEditorText(editor, task.prompt.slice(cursor, match.index));
    const asset = task.assets.find((item) => item.name === match[1]);
    if (!asset) throw new Error(`提示词引用了未上传素材：${match[1]}`);
    await insertMention(editor, asset.mentionLabel);
    cursor = match.index + match[0].length;
  }
  await insertEditorText(editor, task.prompt.slice(cursor));
}

async function submitTask(task) {
  const generate = [...document.querySelectorAll(".cr-send-btn, button")]
    .filter(isVisible)
    .find((button) => /生成|提交/.test(button.textContent));
  if (!generate) throw new Error("找不到生成按钮");
  generate.click();
  await waitFor(
    () => /视频生成任务已提交|生成中|AI\s*正在创作中/.test(document.body.innerText),
    "生成任务进入队列",
    15000
  );
}

async function runTask(task) {
  activeTask = task;
  try {
    await patchTask(task, { status: "claimed" });
    await configurePage(task);
    await clearComposer();
    await patchTask(task, { diagnostics: collectDiagnostics("configured") });
    await patchTask(task, { status: "uploading" });
    await uploadAssets(task);
    await patchTask(task, { diagnostics: collectDiagnostics("uploaded") });
    await patchTask(task, { status: "binding" });
    await fillPromptWithMentions(task);
    await patchTask(task, { diagnostics: collectDiagnostics("bound") });
    if (task.submit) {
      await patchTask(task, { status: "submitting" });
      await submitTask(task);
      await patchTask(task, { status: "submitted", result: "生成任务已提交" });
    } else {
      await patchTask(task, { status: "ready", result: "提示词与素材已绑定，等待提交" });
    }
  } catch (error) {
    await patchTask(task, { status: "failed", error: error.message, diagnostics: collectDiagnostics("failed") });
  } finally {
    activeTask = null;
  }
}

async function poll() {
  if (activeTask || document.visibilityState === "hidden") return;
  try {
    const response = await fetch(`${BRIDGE_URL}/api/bridge/tasks/next`);
    if (response.status === 204) return;
    if (!response.ok) throw new Error("本地桥接服务不可用");
    await runTask(await response.json());
  } catch {
    // The local service may be stopped; the next poll retries quietly.
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "poll") poll();
});

setInterval(poll, POLL_INTERVAL);
poll();
