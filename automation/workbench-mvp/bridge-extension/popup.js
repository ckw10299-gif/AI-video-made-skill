const status = document.querySelector("#status");

document.querySelector("#check").addEventListener("click", async () => {
  status.textContent = "正在通知AI工坊页面...";
  const tabs = await chrome.tabs.query({ url: "http://game-ad-material-mng.bilibili.co/*" });
  if (!tabs.length) {
    status.textContent = "请先打开AI工坊页面。";
    return;
  }
  await chrome.tabs.sendMessage(tabs[0].id, { type: "poll" });
  status.textContent = "已触发任务检查。";
});
