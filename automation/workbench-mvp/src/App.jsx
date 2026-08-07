import { useRef, useState } from "react";
import { Check, ChevronDown, Clipboard, Download, FileText, Film, HelpCircle, Link2, LoaderCircle, MessageSquareText, Plus, Send, Sparkles, Trash2, Upload, WandSparkles, X } from "lucide-react";
import "./styles.css";

const modes = [
  { id: "text", icon: FileText, title: "文生视频", desc: "从剧情与角色直接创作", badge: "原创" },
  { id: "video", icon: Film, title: "视频生视频", desc: "上传视频，复刻结构与节奏", badge: "本地视频" },
  { id: "douyin", icon: Link2, title: "抖音转视频", desc: "粘贴 1–3 条链接批量复刻", badge: "链接" }
];

const initial = {
  mode: "text", style: "游戏三渲二，轻描边，明亮自然光", duration: 10,
  ratio: "9:16", platform: "Seedance", product: "", story: "", replace: "",
  sellingPoint: "", fixedLines: "", notes: "角色形象稳定，动作连续，结尾结果清晰停留 1 秒", links: ""
};

function localPrompt(f, evidence = "") {
  const isShow = /进化|黑化|净化|变身|觉醒|展示|技能|换装/.test(f.story);
  const roleText = f.characters?.length ? f.characters.map(r => `${r.name || "角色"}：形象以对应角色素材为准，${r.purpose || "参与剧情"}。`).join("\n") : "主角：推动主要动作与结果变化；形象以对应角色素材为准。";
  const scene = isShow
    ? "与角色初始形态相匹配的环境。变化触发时光线、地面与空气粒子同步响应，最终环境色调与完成形态统一。"
    : "与剧情功能匹配的明确场景，前景、中景和背景层次清楚，角色站位与关键道具位置保持连续。";
  const content = f.mode === "text"
    ? (isShow
      ? `0–2秒：固定中景建立完整初始形态。\n2–${Math.max(3, f.duration - 3)}秒：变化从明确部位开始，沿身体连续扩散，材质、光影与环境同步变化。\n${Math.max(3, f.duration - 3)}–${f.duration}秒：完成最终形态与一次清楚动作，最后定格1秒。`
      : `分镜1\n时间轴：0–3秒\n运镜：固定机位或简单推近。\n景别：人物中景。\n场景：同一主要场景。\n画面：直接建立角色关系与强视觉钩子。\n具体内容：${f.story || "主角遭遇明确问题，动作与表情让冲突立即可见。"}\n${f.fixedLines ? `配音：${f.fixedLines}` : "音效：环境声与关键动作同步。"}\n\n分镜2\n时间轴：3–${Math.max(4, f.duration - 3)}秒\n运镜：保持空间关系的简单跟拍。\n景别：人物全身中景。\n场景：延续同一空间。\n画面：冲突升级，每个镜头只承担一个核心动作。\n具体内容：角色通过可见动作推动转折，并突出${f.sellingPoint || "核心玩法"}。\n\n分镜3\n时间轴：${Math.max(4, f.duration - 3)}–${f.duration}秒\n运镜：短促推近后稳定。\n景别：结果近景。\n场景：同一场景的结果区域。\n画面：反转结果完整出现，所有在场角色作出可见反应。\n具体内容：结果稳定展示至少1秒。`)
    : `时间轴：0–${f.duration}秒。保持素材中的切镜节奏、构图功能、角色站位与核心动作顺序，每个镜头只承担一个主要动作。${f.replace || "使用当前产品的角色、道具和场景完成本地化。"} 自然呈现${f.product || "当前产品"}的“${f.sellingPoint || "核心卖点"}”，结尾保留完整结果与人物反馈。${f.fixedLines ? `配音逐字使用：“${f.fixedLines}”` : "台词保持原有剧情功能，使用自然、简短的中文口语。"}`;
  return `【画面风格】\n${f.ratio}，${f.style}，适配 ${f.platform}，总时长 ${f.duration} 秒。主体轮廓清晰，角色形态稳定，动作节奏紧凑。\n\n【场景】\n${scene}\n\n【角色】\n${roleText}\n\n【具体内容】\n${content}\n${f.notes ? `\n补充要求：${f.notes}` : ""}\n\n【正向提示词】\n${f.ratio}，${f.style}，统一光源与色温，真实材质与接触阴影，清楚空间关系，单一主运镜，动作连续，角色结构稳定，准确口型，紧凑节奏，纯净画面。\n\n【镜头设计思路】\n${isShow ? "以连续形态变化为核心，明确变化起点、扩散路径、环境反馈和最终定格。" : "前3秒建立钩子，中段用可见动作完成升级，结尾用清楚结果与人物反应落地卖点。"}`;
}

export default function App() {
  const [form, setForm] = useState(initial);
  const [file, setFile] = useState(null);
  const [characters, setCharacters] = useState([{ id: crypto.randomUUID(), name: "", purpose: "" }]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const [chat, setChat] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [messages, setMessages] = useState([]);
  const [modeLabel, setModeLabel] = useState("本地规则模式");
  const fileRef = useRef(null);
  const update = (key, value) => setForm(v => ({ ...v, [key]: value }));
  const updateRole = (id, key, value) => setCharacters(list => list.map(role => role.id === id ? { ...role, [key]: value } : role));
  const addRole = () => setCharacters(list => [...list, { id: crypto.randomUUID(), name: "", purpose: "" }]);
  const switchMode = (mode) => { setForm(v => ({ ...v, mode })); setFile(null); setPrompt(""); setMessages([]); };
  const links = form.links.split(/\n/).map(x => x.trim()).filter(Boolean).slice(0, 3);
  const canGenerate = form.mode === "text" ? form.story.trim() : form.mode === "video" ? !!file && form.replace.trim() : links.length > 0 && form.replace.trim();

  async function getEvidence() {
    if (form.mode === "video" && file) {
      const body = new FormData(); body.append("video", file);
      const r = await fetch("/api/video/analyze", { method: "POST", body }); const d = await r.json();
      return d.error ? "视频读取未完成，将按用户填写信息生成初稿。" : `${d.name}，${d.duration}秒，${d.width}×${d.height}，已抽取${d.frames?.length || 0}个关键帧。`;
    }
    if (form.mode === "douyin") return `${links.length}条抖音链接已按输入顺序建立独立任务，生成时互不混用角色与剧情。`;
    return "";
  }

  async function generate() {
    if (!canGenerate) return;
    setBusy(true);
    try {
      const evidence = await getEvidence();
      let next = form.mode === "douyin"
        ? links.map((_, i) => `提示词 ${i + 1}\n\n${localPrompt({ ...form, characters, mode: "video" }, evidence)}`).join("\n\n────────────\n\n")
        : localPrompt({ ...form, characters }, evidence);
      const response = await fetch("/api/prompt/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, characters, type: form.mode === "text" ? "text" : "video", story: form.mode === "text" ? form.story : form.replace, sourceEvidence: evidence, douyinLinks: links }) });
      if (response.ok) { const data = await response.json(); if (data.mode === "openai") { next = data.prompt; setModeLabel("AI 已按 Skill 生成"); } else setModeLabel("Skill 规则生成"); }
      setPrompt(next); setMessages([{ role: "ai", text: "完整提示词已生成。你可以直接编辑，也可以告诉我只修改哪一部分。" }]);
      setTimeout(() => document.querySelector(".studio")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch { setPrompt(localPrompt({ ...form, characters })); setModeLabel("Skill 规则生成"); }
    setBusy(false);
  }

  async function revise() {
    const instruction = chat.trim(); if (!instruction || !prompt) return;
    setChat(""); setChatBusy(true); setMessages(m => [...m, { role: "user", text: instruction }]);
    try {
      const r = await fetch("/api/prompt/revise", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, instruction }) });
      const data = await r.json();
      if (r.ok) { setPrompt(data.prompt); setMessages(m => [...m, { role: "ai", text: data.reply }]); setModeLabel(data.mode === "openai" ? "AI 已修改" : "修改意见已记录"); }
      else throw new Error();
    } catch { setMessages(m => [...m, { role: "ai", text: "修改服务暂时不可用，请稍后重试。" }]); }
    setChatBusy(false);
  }

  function download() { const b = new Blob([prompt], { type: "text/markdown;charset=utf-8" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = "AI视频提示词.md"; a.click(); URL.revokeObjectURL(u); }

  return <div className="app"><header><div className="brand"><span><WandSparkles size={20}/></span><div><b>镜构</b><small>AI VIDEO PROMPT</small></div></div><button className="help-button" onClick={() => setHelp(true)}><HelpCircle size={17}/>使用教程</button></header>
    <main><section className="hero"><span className="eyebrow"><Sparkles size={14}/> BUILT WITH AI-VIDEO-MADE-SKILL</span><h1>选择一种方式，<br/><em>生成完整视频提示词</em></h1><p>模板会随模式自动变化。你只提供必要信息，分析、分镜与提示词结构由系统处理。</p></section>
      <section className="mode-picker">{modes.map(({id,icon:Icon,title,desc,badge}) => <button key={id} className={form.mode === id ? "active" : ""} onClick={() => switchMode(id)}><Icon size={21}/><div><b>{title}</b><small>{desc}</small></div><em>{badge}</em>{form.mode === id && <Check className="mode-check" size={14}/>}</button>)}</section>
      <section className="creator-card"><div className="template-label"><span>{modes.find(x=>x.id===form.mode)?.title}模板</span><small>仅显示当前模式需要填写的内容</small></div>
        {form.mode === "video" && <div className="input-block"><label className={`upload-zone ${file ? "has-file" : ""}`}><input ref={fileRef} type="file" accept="video/*" onChange={e=>setFile(e.target.files?.[0] || null)}/><Upload size={24}/><b>{file?.name || "上传要复刻的本地视频"}</b><small>{file ? `${(file.size/1024/1024).toFixed(1)} MB · 点击更换` : "MP4 / MOV · 系统将先读取并抽帧"}</small></label></div>}
        {form.mode === "douyin" && <div className="input-block"><label><span>抖音链接 <b>1–3 条</b></span><textarea rows="4" value={form.links} onChange={e=>update("links",e.target.value)} placeholder="每行粘贴一条抖音链接，最多三条"/><small>将按链接顺序逐条分析、逐条生成，任务之间互不混用。</small></label></div>}
        <div className="simple-form">
          <label><span>画风</span><input value={form.style} onChange={e=>update("style",e.target.value)} placeholder="例如：古早日本动漫、游戏三渲二、高级CG游戏PV"/></label>
          <div className="template-section"><div className="template-section-head"><div><b>出现角色</b><small>角色总数：{characters.length}</small></div><button type="button" onClick={addRole}><Plus size={14}/>添加角色</button></div><div className="role-list">{characters.map((role,index)=><div className="role-row" key={role.id}><span>{index+1}</span><label><small>角色名称</small><input value={role.name} onChange={e=>updateRole(role.id,"name",e.target.value)} placeholder={`角色${index+1}`}/></label><label><small>剧情作用</small><input value={role.purpose} onChange={e=>updateRole(role.id,"purpose",e.target.value)} placeholder="例如：主角、制造冲突、完成反转"/></label><button className="remove-role" type="button" disabled={characters.length===1} onClick={()=>setCharacters(list=>list.filter(x=>x.id!==role.id))}><Trash2 size={15}/></button></div>)}</div></div>
          <label><span>{form.mode === "text" ? "大致剧情" : "需要替换或改编的内容"} <b>必填</b></span><textarea rows="4" value={form.mode === "text" ? form.story : form.replace} onChange={e=>update(form.mode === "text" ? "story" : "replace",e.target.value)} placeholder={form.mode === "text" ? "填写开头、发展、转折、结尾；展示类可填写变化过程" : "填写需要替换的角色、道具、场景，以及必须保留的结构或台词功能"}/></label>
          <div className="template-section"><div className="template-section-head"><div><b>备注</b><small>产品、卖点、台词、画幅与平台</small></div></div><div className="note-grid"><label><small>产品名</small><input value={form.product} onChange={e=>update("product",e.target.value)} placeholder="游戏或产品名称"/></label><label><small>核心卖点</small><input value={form.sellingPoint} onChange={e=>update("sellingPoint",e.target.value)} placeholder="真实卖点"/></label><label className="wide"><small>固定台词（逐字保留）</small><textarea rows="2" value={form.fixedLines} onChange={e=>update("fixedLines",e.target.value)} placeholder="没有可留空"/></label><label><small>平台</small><div className="select-wrap"><select value={form.platform} onChange={e=>update("platform",e.target.value)}>{["Seedance","即梦","可灵","Sora","Runway"].map(x=><option key={x}>{x}</option>)}</select><ChevronDown size={15}/></div></label><label><small>画幅</small><div className="select-wrap"><select value={form.ratio} onChange={e=>update("ratio",e.target.value)}><option>9:16</option><option>16:9</option><option>1:1</option></select><ChevronDown size={15}/></div></label><label><small>时长</small><div className="duration"><input type="number" min="3" max="60" value={form.duration} onChange={e=>update("duration",Number(e.target.value))}/><i>秒</i></div></label><label className="wide"><small>必须保留或禁止出现的内容</small><textarea rows="2" value={form.notes} onChange={e=>update("notes",e.target.value)}/></label></div></div>
        </div><button className="generate" disabled={!canGenerate || busy} onClick={generate}>{busy?<LoaderCircle className="spin" size={19}/>:<Sparkles size={19}/>} {busy ? "正在分析并生成…" : "生成完整视频提示词"}</button>{!canGenerate && <p className="button-hint">{form.mode === "text" ? "请填写大致剧情" : form.mode === "video" ? "请先上传本地视频" : "请至少填写一条抖音链接"}</p>}</section>
      {prompt && <section className="studio"><div className="result-card"><div className="result-head"><div><span><Check size={14}/>{modeLabel}</span><h2>完整视频提示词</h2><small>可以直接在下方修改</small></div><div><button onClick={()=>navigator.clipboard.writeText(prompt)}><Clipboard size={16}/>复制</button><button onClick={download}><Download size={16}/>下载</button></div></div><textarea value={prompt} onChange={e=>setPrompt(e.target.value)}/></div>
        <aside className="chat-card"><div className="chat-head"><MessageSquareText size={18}/><div><b>用自然语言修改</b><small>告诉 AI 只改哪里</small></div></div><div className="messages">{messages.map((m,i)=><div key={i} className={`message ${m.role}`}>{m.text}</div>)}{chatBusy&&<div className="message ai"><LoaderCircle className="spin" size={15}/>正在修改全文…</div>}</div><div className="quick"><button onClick={()=>setChat("把节奏压缩得更紧凑，保持总时长不变")}>节奏更快</button><button onClick={()=>setChat("只修改画面风格，改成真人实拍短剧")}>改成真人</button><button onClick={()=>setChat("检查所有分镜时长之和，并修正为目标时长")}>检查时长</button></div><div className="chat-input"><textarea rows="3" value={chat} onChange={e=>setChat(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();revise();}}} placeholder="例如：只把第三个分镜改成固定机位，其他内容保持不变"/><button disabled={!chat.trim()||chatBusy} onClick={revise}><Send size={16}/></button></div></aside></section>}
    </main>
    {help&&<div className="modal-backdrop" onClick={()=>setHelp(false)}><div className="modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setHelp(false)}><X/></button><span className="eyebrow">使用教程</span><h2>先选模式，再按模板填写</h2><ol><li><b>文生视频</b><p>填写画风、角色和剧情，系统自动判断剧情类或展示类结构。</p></li><li><b>视频生视频</b><p>上传可读取的视频后，系统先分析镜头、站位、动作和节奏，再本地化。</p></li><li><b>抖音转视频</b><p>一次粘贴1–3条链接，系统逐条分析并输出同等数量的提示词。</p></li><li><b>生成后修改</b><p>左侧可直接编辑全文；右侧可用自然语言要求AI局部修改。</p></li></ol><button className="generate" onClick={()=>setHelp(false)}>开始创作</button></div></div>}
  </div>;
}
