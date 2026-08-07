import "dotenv/config";
import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import multer from "multer";

const execFileAsync = promisify(execFile);
const app = express();
const port = Number(process.env.PORT || 8787);
const root = path.resolve(process.cwd());
const uploadsDir = path.join(root, "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: "4mb" }));
app.use("/uploads", express.static(uploadsDir));

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 800 * 1024 * 1024 }
});

const jobs = new Map();
const bridgeTasks = new Map();
const bridgeAssetRoot = path.resolve(
  process.env.BRIDGE_ASSET_ROOT || path.join(root, "materials")
);
const aiModel = process.env.OPENAI_MODEL || "gpt-5.6-terra";

const videoPromptInstructions = `你是顶级AI视频美术指导和中文Prompt专家，负责生成可直接用于即梦、可灵、Seedance、Sora、Runway的提示词。
严格区分文生视频和视频生视频，不把其他任务的元素带入当前任务。
支持三种路由：文生视频根据剧情直接创作；视频生视频必须依据已读取的视频证据复刻镜头机制；抖音链接一次处理1至3条并按顺序输出同等数量的独立提示词。
最终输出依次包含【画面风格】【场景】【角色】【其他参考】（仅存在关键物品素材时）、【具体内容】【正向提示词】【镜头设计思路】。
【角色】只写角色名称、剧情作用，并结合当前需求补全必要但简洁的形象、性格和声线，不要堆砌服装细节。
剧情类按清楚的时间轴拆分镜头，每个镜头只承担一个主要动作；运镜、景别和场景切换写清楚但不过度复杂。真人短剧使用白描式动作顺序。
展示类遵循原始形态、局部变化、变化扩散、场景同步变化、最终形态定格的结构。
用户提供的固定台词逐字保留，不擅自补充语气词或新台词。台词必须能在对应时长内说完。
【正向提示词】只写画幅、媒介、年代、渲染、光影、材质、镜头、节奏和稳定性等生成方向，不写剧情摘要。
最终成稿必须独立成立，不出现“原视频、参考视频、复刻原片、上一段、根据前文、用户提供”等过程词，不写分析过程。
不要解释创作过程，只输出完整中文提示词。`;

function clean(value, fallback = "待补充") {
  return String(value || "").trim() || fallback;
}

function buildPrompt(input) {
  const characters = Array.isArray(input.characters) ? input.characters : [];
  const roleText = characters.length
    ? characters.map((role) => `${clean(role.name, "角色")}：${clean(role.purpose, "参与剧情")}；具体形象、性格和声线根据剧情及已选素材自动补充。`).join("\n")
    : "主角：推动剧情；具体形象、性格和声线根据剧情及已选素材自动补充。";
  const duration = clean(input.duration, "10秒");
  const type = input.type === "video" ? "视频生视频" : "文生视频";
  const source = input.type === "video"
    ? `输入视频用于分析画面构图、动作顺序、镜头机制和台词功能；本地化要求为：${clean(input.story)}`
    : clean(input.story);
  const scene = clean(input.scene, "与剧情功能匹配的游戏本地化场景，空间关系清晰，主要角色站位稳定");

  return `【画面风格】\n${clean(input.style, "游戏三渲二风格，人物带轻描边，明亮自然光，稳定角色形象")}。竖屏9:16，${type}，总时长约${duration}，动作顺序清楚，台词口型准确。\n\n【场景】\n${scene}。场景中的材质、光源方向、人物比例和空间位置保持连续。\n\n【角色】\n${roleText}\n\n【其他参考】\n关键角色、噜咪、宠物蛋、道具和场景素材从已连接的物料库中选择；同一对象在整段视频中保持颜色、结构与配饰一致。\n\n【具体内容】\n时间轴：0-${duration}\n${source}\n\n开场：在前2秒内直接展示主要冲突或视觉钩子，镜头明确交代角色站位和关键道具。\n发展：每个画面只承担一个主要动作或信息，角色按照先后顺序完成动作和台词。\n转折：通过可见动作完成结果变化，相关角色给出清晰、简单的情绪反应。\n结尾：用完整动作承接产品卖点或悬念，保持主体大小稳定，结尾画面清楚。\n\n备注：${clean(input.notes, "台词口语化，运镜和场景切换清楚且不过度复杂")}\n\n【正向提示词】\n竖屏9:16，${clean(input.style, "游戏三渲二风格")}，清晰镜头语言，稳定人物站位，准确动作顺序，连贯空间关系，角色形象稳定，材质统一，光影统一，清晰口型，紧凑节奏，明确情绪反应，干净画面。`;
}

async function callOpenAI(instruction, payload) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  let response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: aiModel,
        instructions: videoPromptInstructions,
        input: `${instruction}\n\n当前内容：\n${payload}`
      })
    });
  } catch (error) {
    if (error.name === "AbortError") throw new Error("AI 请求超时，请稍后重试");
    throw new Error(`无法连接 OpenAI API：${error.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    const apiMessage = detail.error?.message || "未知错误";
    if (response.status === 401) throw new Error("OpenAI API 密钥无效，请检查 .env 中的 OPENAI_API_KEY");
    if (response.status === 429) throw new Error("OpenAI API 请求受限，请检查额度、账单或稍后重试");
    throw new Error(`OpenAI API 请求失败（${response.status}）：${apiMessage}`);
  }
  const data = await response.json();
  const text = data.output_text || data.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("") || "";
  if (!text.trim()) throw new Error("OpenAI API 已响应，但没有返回提示词文本");
  return text.trim();
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    aiMode: process.env.OPENAI_API_KEY ? "openai" : "demo",
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    aiModel,
    videoProvider: process.env.VIDEO_PROVIDER || "mock"
  });
});

app.post("/api/ai/test", async (_req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(400).json({ error: "尚未配置 OPENAI_API_KEY" });
  }
  try {
    await callOpenAI("这是连接测试。只输出：连接成功", "无需生成视频提示词。只检查API是否可用。");
    res.json({ ok: true, model: aiModel, message: "OpenAI API 连接成功" });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.post("/api/prompt/generate", async (req, res) => {
  try {
    const fallback = buildPrompt(req.body);
    const ai = await callOpenAI("根据以下需求生成一份可直接使用的中文视频提示词。", JSON.stringify(req.body, null, 2));
    res.json({ prompt: ai || fallback, mode: ai ? "openai" : "demo" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/prompt/revise", async (req, res) => {
  try {
    const { prompt = "", instruction = "" } = req.body;
    const ai = await callOpenAI(`严格按照修改意见重写完整提示词。修改意见：${instruction}`, prompt);
    const marker = "\n\n【本轮修改要求】\n";
    const base = prompt.includes(marker) ? prompt.slice(0, prompt.indexOf(marker)) : prompt;
    res.json({
      prompt: ai || `${base}${marker}${clean(instruction, "保持当前内容")}`,
      reply: ai ? "已按要求重写完整提示词。" : "演示模式已记录修改；配置 OPENAI_API_KEY 后会自动重写全文。",
      mode: ai ? "openai" : "demo"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/materials/scan", async (req, res) => {
  const target = clean(req.body.path, "");
  if (!target) return res.status(400).json({ error: "请输入物料库路径" });
  try {
    const stat = await fs.promises.stat(target);
    if (!stat.isDirectory()) return res.status(400).json({ error: "路径不是文件夹" });
    const allowed = new Set([".png", ".jpg", ".jpeg", ".webp", ".mp4", ".mov", ".m4a", ".wav"]);
    const entries = await fs.promises.readdir(target, { withFileTypes: true });
    const items = entries
      .filter((entry) => entry.isFile() && allowed.has(path.extname(entry.name).toLowerCase()))
      .slice(0, 80)
      .map((entry) => ({ name: entry.name, type: path.extname(entry.name).toLowerCase().slice(1), path: path.join(target, entry.name) }));
    res.json({ path: target, total: items.length, items });
  } catch (error) {
    res.status(400).json({ error: `无法读取该路径：${error.message}` });
  }
});

app.post("/api/video/analyze", upload.single("video"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "请选择视频文件" });
  const jobDir = path.join(uploadsDir, crypto.randomUUID());
  fs.mkdirSync(jobDir, { recursive: true });
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration", "-show_entries", "stream=width,height,r_frame_rate", "-of", "json", req.file.path
    ]);
    const metadata = JSON.parse(stdout);
    const pattern = path.join(jobDir, "frame-%02d.jpg");
    await execFileAsync("ffmpeg", ["-y", "-v", "error", "-i", req.file.path, "-vf", "fps=1/2,scale=240:-1", "-frames:v", "6", pattern]);
    const frames = (await fs.promises.readdir(jobDir))
      .filter((name) => name.endsWith(".jpg"))
      .sort()
      .map((name) => `/uploads/${path.basename(jobDir)}/${name}`);
    res.json({
      name: req.file.originalname,
      duration: Number(metadata.format?.duration || 0).toFixed(1),
      width: metadata.streams?.[0]?.width,
      height: metadata.streams?.[0]?.height,
      frames,
      summary: "已完成视频读取、基础元数据检查与关键帧抽取。"
    });
  } catch (error) {
    res.status(500).json({ error: `视频分析失败：${error.message}` });
  }
});

app.post("/api/video/analyze-url", async (req, res) => {
  const url = clean(req.body.url, "");
  if (!url) return res.status(400).json({ error: "请输入视频链接" });
  res.json({ name: url, duration: "待下载", frames: [], summary: "链接已进入下载与抽帧队列。MVP演示模式暂不抓取受登录保护的视频。" });
});

app.post("/api/jobs", (req, res) => {
  const id = crypto.randomUUID();
  jobs.set(id, { id, createdAt: Date.now(), prompt: req.body.prompt || "", provider: process.env.VIDEO_PROVIDER || "mock" });
  res.json({ id, status: "queued", provider: process.env.VIDEO_PROVIDER || "mock" });
});

app.get("/api/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "任务不存在" });
  const elapsed = Date.now() - job.createdAt;
  const status = elapsed < 1800 ? "queued" : elapsed < 6500 ? "generating" : "completed";
  const progress = status === "queued" ? 12 : status === "generating" ? Math.min(92, 28 + Math.round((elapsed - 1800) / 70)) : 100;
  res.json({ ...job, status, progress, output: status === "completed" ? { label: "演示任务已完成", url: null } : null });
});

function isInsideAssetRoot(filePath) {
  const resolved = path.resolve(filePath);
  const relative = path.relative(bridgeAssetRoot, resolved);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

app.post("/api/bridge/tasks", async (req, res) => {
  const prompt = String(req.body.prompt || "").trim();
  const assets = Array.isArray(req.body.assets) ? req.body.assets : [];
  if (!prompt) return res.status(400).json({ error: "缺少完整提示词" });
  if (!assets.length) return res.status(400).json({ error: "至少需要一个参考素材" });

  for (const asset of assets) {
    if (!asset?.name || !asset?.path || !isInsideAssetRoot(asset.path)) {
      return res.status(400).json({ error: `素材不在允许的物料库中：${asset?.path || "未知路径"}` });
    }
    try {
      const stat = await fs.promises.stat(path.resolve(asset.path));
      if (!stat.isFile()) throw new Error("不是文件");
    } catch {
      return res.status(400).json({ error: `无法读取素材：${asset.path}` });
    }
  }

  const id = crypto.randomUUID();
  const task = {
    id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "queued",
    prompt,
    assets: assets.map((asset, index) => ({
      name: String(asset.name),
      path: path.resolve(asset.path),
      mentionLabel: String(asset.mentionLabel || `图片${index + 1}`)
    })),
    config: {
      mode: "视频生成",
      workspace: "个人",
      ratio: String(req.body.config?.ratio || "16:9"),
      resolution: String(req.body.config?.resolution || "720p"),
      duration: Number(req.body.config?.duration || 15)
    },
    submit: Boolean(req.body.submit),
    result: null,
    error: null
  };
  bridgeTasks.set(id, task);
  res.json(task);
});

app.get("/api/bridge/tasks/next", (_req, res) => {
  const task = [...bridgeTasks.values()]
    .filter((item) => item.status === "queued")
    .sort((a, b) => a.createdAt - b.createdAt)[0];
  if (!task) return res.status(204).end();
  res.json(task);
});

app.get("/api/bridge/tasks/:id", (req, res) => {
  const task = bridgeTasks.get(req.params.id);
  if (!task) return res.status(404).json({ error: "桥接任务不存在" });
  res.json(task);
});

app.patch("/api/bridge/tasks/:id", (req, res) => {
  const task = bridgeTasks.get(req.params.id);
  if (!task) return res.status(404).json({ error: "桥接任务不存在" });
  const allowed = new Set(["queued", "claimed", "uploading", "binding", "ready", "submitting", "submitted", "failed"]);
  if (req.body.status && !allowed.has(req.body.status)) {
    return res.status(400).json({ error: "无效任务状态" });
  }
  Object.assign(task, {
    status: req.body.status || task.status,
    result: req.body.result ?? task.result,
    error: req.body.error ?? task.error,
    diagnostics: req.body.diagnostics ?? task.diagnostics,
    updatedAt: Date.now()
  });
  res.json(task);
});

app.get("/api/bridge/assets/:taskId/:assetIndex", (req, res) => {
  const task = bridgeTasks.get(req.params.taskId);
  const index = Number(req.params.assetIndex);
  const asset = task?.assets?.[index];
  if (!task || !asset || !isInsideAssetRoot(asset.path)) {
    return res.status(404).json({ error: "素材不存在" });
  }
  res.sendFile(asset.path);
});

app.listen(port, () => {
  console.log(`AI video workflow API listening on http://127.0.0.1:${port}`);
});
