const attachedTabs = new Set();

async function ensureAttached(tabId) {
  if (attachedTabs.has(tabId)) return;
  await chrome.debugger.attach({ tabId }, "1.3");
  attachedTabs.add(tabId);
}

async function command(tabId, method, params = {}) {
  await ensureAttached(tabId);
  return chrome.debugger.sendCommand({ tabId }, method, params);
}

async function releaseTab(tabId) {
  if (!attachedTabs.has(tabId)) return;
  try {
    await chrome.debugger.detach({ tabId });
  } finally {
    attachedTabs.delete(tabId);
  }
}

async function selectAllAndDelete(tabId) {
  await command(tabId, "Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key: "a",
    code: "KeyA",
    windowsVirtualKeyCode: 65,
    modifiers: 2,
    commands: ["SelectAll"]
  });
  await command(tabId, "Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "a",
    code: "KeyA",
    windowsVirtualKeyCode: 65,
    modifiers: 2
  });
  await command(tabId, "Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key: "Backspace",
    code: "Backspace",
    windowsVirtualKeyCode: 8,
    commands: ["DeleteBackward"]
  });
  await command(tabId, "Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Backspace",
    code: "Backspace",
    windowsVirtualKeyCode: 8
  });
}

chrome.debugger.onDetach.addListener(({ tabId }) => attachedTabs.delete(tabId));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if (!tabId) {
    sendResponse({ ok: false, error: "无法识别AI工坊标签页" });
    return;
  }

  (async () => {
    if (message.type === "replaceEditorText") {
      await selectAllAndDelete(tabId);
      if (message.text) await command(tabId, "Input.insertText", { text: message.text });
      return { ok: true };
    }
    if (message.type === "insertEditorText") {
      if (message.text === "@") {
        await command(tabId, "Input.dispatchKeyEvent", {
          type: "char",
          key: "@",
          code: "Digit2",
          text: "@",
          unmodifiedText: "@"
        });
      } else {
        await command(tabId, "Input.insertText", { text: message.text || "" });
      }
      return { ok: true };
    }
    if (message.type === "pressBackspace") {
      await command(tabId, "Input.dispatchKeyEvent", {
        type: "rawKeyDown",
        key: "Backspace",
        code: "Backspace",
        windowsVirtualKeyCode: 8,
        commands: ["DeleteBackward"]
      });
      await command(tabId, "Input.dispatchKeyEvent", {
        type: "keyUp",
        key: "Backspace",
        code: "Backspace",
        windowsVirtualKeyCode: 8
      });
      return { ok: true };
    }
    if (message.type === "setFileInputFiles") {
      const documentNode = await command(tabId, "DOM.getDocument", { depth: 1 });
      const inputNode = await command(tabId, "DOM.querySelector", {
        nodeId: documentNode.root.nodeId,
        selector: 'input[type="file"]'
      });
      if (!inputNode.nodeId) throw new Error("找不到文件上传控件");
      await command(tabId, "DOM.setFileInputFiles", {
        nodeId: inputNode.nodeId,
        files: message.paths
      });
      return { ok: true };
    }
    return { ok: false, error: "未知桥接命令" };
  })()
    .then(async (result) => {
      await releaseTab(tabId);
      sendResponse(result);
    })
    .catch(async (error) => {
      await releaseTab(tabId).catch(() => {});
      sendResponse({ ok: false, error: error.message });
    });
  return true;
});
