var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_bcrypt = __toESM(require("bcrypt"), 1);
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
var app = (0, import_express.default)();
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
app.use(import_express.default.json({ limit: "15mb" }));
var dbInbox = {};
var clients = [];
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString() });
});
app.post("/api/sync/create-space", async (req, res) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let spaceId = "SPACE-";
  for (let i = 0; i < 4; i++) spaceId += chars.charAt(Math.floor(Math.random() * chars.length));
  spaceId += "-";
  for (let i = 0; i < 4; i++) spaceId += chars.charAt(Math.floor(Math.random() * chars.length));
  try {
    await prisma.space.create({
      data: {
        id: spaceId
      }
    });
    res.json({ spaceId, success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to create space" });
  }
});
app.get("/api/sync/space/:spaceId", async (req, res) => {
  const { spaceId } = req.params;
  try {
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
      include: { tasks: true }
    });
    if (!space) {
      return res.status(404).json({ error: "Space not found" });
    }
    const inbox = dbInbox[spaceId] || [];
    const mappedTasks = space.tasks.map((t) => ({
      id: t.id,
      encryptedData: t.notes || "",
      updatedAt: t.updatedAt.getTime()
    }));
    res.json({
      spaceId: space.id,
      tasks: mappedTasks,
      inbox,
      updatedAt: space.updatedAt.getTime()
    });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});
app.post("/api/sync/space/:spaceId/update", async (req, res) => {
  const { spaceId } = req.params;
  const { tasks } = req.body;
  if (!Array.isArray(tasks)) {
    return res.status(400).json({ error: "Invalid tasks payload" });
  }
  try {
    let space = await prisma.space.findUnique({ where: { id: spaceId } });
    if (!space) {
      space = await prisma.space.create({ data: { id: spaceId } });
    }
    for (const t of tasks) {
      await prisma.task.upsert({
        where: { id: t.id },
        create: {
          id: t.id,
          spaceId: space.id,
          title: "Encrypted Task",
          notes: t.encryptedData || t.data || ""
        },
        update: {
          notes: t.encryptedData || t.data || ""
        }
      });
    }
    const updatedAt = Date.now();
    const senderClientId = req.headers["x-client-id"];
    clients.forEach((client) => {
      if (client.spaceId === spaceId && client.id !== senderClientId) {
        try {
          client.res.write(`data: ${JSON.stringify({ type: "sync", spaceId, updatedAt })}

`);
        } catch (err) {
          console.error("Error sending SSE update:", err);
        }
      }
    });
    res.json({ success: true, updatedAt });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ error: "Database error" });
  }
});
app.post("/api/sync/space/:spaceId/share", async (req, res) => {
  const { spaceId } = req.params;
  const { senderSpaceId, encryptedData, taskId } = req.body;
  if (!encryptedData) {
    return res.status(400).json({ error: "encryptedData is required" });
  }
  try {
    const space = await prisma.space.findUnique({ where: { id: spaceId } });
    if (!space) {
      return res.status(404).json({ error: "\u06A9\u062F \u0641\u0636\u0627\u06CC \u0645\u0642\u0635\u062F \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." });
    }
    if (!dbInbox[spaceId]) {
      dbInbox[spaceId] = [];
    }
    const newSharedTask = {
      id: taskId || Math.random().toString(36).substring(7),
      senderSpaceId: senderSpaceId || "\u0646\u0627\u0634\u0646\u0627\u0633",
      encryptedData,
      sharedAt: Date.now()
    };
    dbInbox[spaceId].push(newSharedTask);
    clients.forEach((client) => {
      if (client.spaceId === spaceId) {
        try {
          client.res.write(
            `data: ${JSON.stringify({
              type: "share",
              spaceId,
              senderSpaceId: senderSpaceId || "\u0646\u0627\u0634\u0646\u0627\u0633",
              sharedTask: newSharedTask
            })}

`
          );
        } catch (err) {
          console.error("Failed to push SSE notification to shared client:", err);
        }
      }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});
app.post("/api/sync/space/:spaceId/inbox/remove", (req, res) => {
  const { spaceId } = req.params;
  const { taskId } = req.body;
  if (dbInbox[spaceId]) {
    dbInbox[spaceId] = dbInbox[spaceId].filter((t) => t.id !== taskId);
  }
  res.json({ success: true });
});
app.get("/api/sync/subscribe", (req, res) => {
  const spaceId = req.query.spaceId;
  const clientId = req.query.clientId;
  if (!spaceId) {
    return res.status(400).json({ error: "spaceId is required" });
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const client = {
    id: clientId || Math.random().toString(36).substring(7),
    spaceId,
    res
  };
  clients.push(client);
  res.write(`data: ${JSON.stringify({ type: "connected", clientId: client.id })}

`);
  req.on("close", () => {
    clients = clients.filter((c) => c.id !== client.id);
  });
});
app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0648 \u06AF\u0630\u0631\u0648\u0627\u0698\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0647\u0633\u062A\u0646\u062F." });
  }
  const normalized = username.trim().toLowerCase();
  try {
    const existingUser = await prisma.user.findUnique({ where: { username: normalized } });
    if (existingUser) {
      return res.status(400).json({ error: "\u0627\u06CC\u0646 \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0642\u0628\u0644\u0627\u064B \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A." });
    }
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let spaceId = "SPACE-";
    for (let i = 0; i < 4; i++) spaceId += chars.charAt(Math.floor(Math.random() * chars.length));
    spaceId += "-";
    for (let i = 0; i < 4; i++) spaceId += chars.charAt(Math.floor(Math.random() * chars.length));
    const saltRounds = 10;
    const passwordHash = await import_bcrypt.default.hash(password, saltRounds);
    await prisma.space.create({ data: { id: spaceId } });
    const newUser = await prisma.user.create({
      data: {
        username: normalized,
        passwordHash,
        spaceId
      }
    });
    res.json({ success: true, username: username.trim(), spaceId });
  } catch (error) {
    console.error("Error in registration:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "\u0648\u0627\u0631\u062F \u06A9\u0631\u062F\u0646 \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0648 \u06AF\u0630\u0631\u0648\u0627\u0698\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." });
  }
  const normalized = username.trim().toLowerCase();
  try {
    const user = await prisma.user.findUnique({ where: { username: normalized } });
    if (!user) {
      return res.status(400).json({ error: "\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u06CC\u0627 \u06AF\u0630\u0631\u0648\u0627\u0698\u0647 \u0646\u0627\u062F\u0631\u0633\u062A \u0627\u0633\u062A." });
    }
    const match = await import_bcrypt.default.compare(password, user.passwordHash);
    const isLegacyPlaintext = user.passwordHash === password;
    if (!match && !isLegacyPlaintext) {
      return res.status(400).json({ error: "\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u06CC\u0627 \u06AF\u0630\u0631\u0648\u0627\u0698\u0647 \u0646\u0627\u062F\u0631\u0633\u062A \u0627\u0633\u062A." });
    }
    if (isLegacyPlaintext) {
      const saltRounds = 10;
      await prisma.user.update({
        where: { username: normalized },
        data: { passwordHash: await import_bcrypt.default.hash(password, saltRounds) }
      });
    }
    res.json({ success: true, username: user.username, spaceId: user.spaceId });
  } catch (error) {
    console.error("Error in login:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
app.post("/api/ai/parse-task", async (req, res) => {
  const { prompt, todayContext } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "\u0645\u062A\u0646 \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06CC \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u062E\u0627\u0644\u06CC \u0628\u0627\u0634\u062F." });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "\u06A9\u0644\u06CC\u062F API \u0645\u0631\u0628\u0648\u0637 \u0628\u0647 \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06CC (GEMINI_API_KEY) \u062F\u0631 \u0633\u0631\u0648\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F. \u0644\u0637\u0641\u0627\u064B \u062F\u0631 \u0628\u062E\u0634 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0648\u0627\u0631\u062F \u06A9\u0646\u06CC\u062F." });
  }
  try {
    const ai = new import_genai.GoogleGenAI({ apiKey });
    const systemPrompt = `You are an expert Persian task extraction assistant.
Extract lists of individual tasks, reminders, and action items from the user's input.
Always return a valid JSON array of objects conforming to the requested schema.
Use Persian language for task titles and notes.
Do not use markdown formatting in your response. Return ONLY raw JSON.

Current context info:
- Today is: ${todayContext || (/* @__PURE__ */ new Date()).toLocaleString("fa-IR")}
- Use this context to resolve relative dates like "\u0641\u0631\u062F\u0627" (tomorrow), "\u0634\u0646\u0628\u0647" (Saturday), "\u067E\u0633\u200C\u0641\u0631\u062F\u0627", "\u0622\u062E\u0631 \u0647\u0641\u062A\u0647", etc., into the exact Jalali format YYYY/MM/DD based on the provided context (\u0627\u0645\u0631\u0648\u0632).`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `\u0645\u062A\u0646 \u06A9\u0627\u0631\u0628\u0631 \u0628\u0631\u0627\u06CC \u0627\u0633\u062A\u062E\u0631\u0627\u062C \u062A\u0633\u06A9\u200C\u0647\u0627: "${prompt}"`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.ARRAY,
          description: "List of parsed tasks",
          items: {
            type: import_genai.Type.OBJECT,
            properties: {
              title: { type: import_genai.Type.STRING, description: "Persian title of the task" },
              notes: { type: import_genai.Type.STRING, description: "Persian extra notes, descriptions or contexts of the task" },
              priority: {
                type: import_genai.Type.STRING,
                enum: ["low", "medium", "high"],
                description: "Priority of the task based on importance keywords used"
              },
              category: { type: import_genai.Type.STRING, description: "One of standard categories (\u0634\u062E\u0635\u06CC, \u06A9\u0627\u0631\u06CC, \u062F\u0631\u0633, \u0633\u0644\u0627\u0645\u062A, \u062E\u0631\u06CC\u062F, \u0645\u0627\u0644\u06CC) or a suitable custom Persian category" },
              dueDate: { type: import_genai.Type.STRING, description: "Calculated date in YYYY-MM-DD format" },
              reminderTime: { type: import_genai.Type.STRING, description: "Extracted time of day in HH:MM format" }
            },
            required: ["title", "priority", "category"]
          }
        }
      }
    });
    const textResponse = response.text;
    if (!textResponse) {
      throw new Error("Empty response from Gemini API");
    }
    const tasks = JSON.parse(textResponse.trim());
    res.json({ success: true, tasks });
  } catch (error) {
    console.error("AI Parse Task Error:", error);
    res.status(500).json({ error: `\u062E\u0637\u0627 \u062F\u0631 \u067E\u0631\u062F\u0627\u0632\u0634 \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06CC: ${error.message || error}` });
  }
});
app.post("/api/ai/upload-file", async (req, res) => {
  const { base64, mimeType, todayContext } = req.body;
  if (!base64 || !mimeType) {
    return res.status(400).json({ error: "\u0641\u0627\u06CC\u0644 \u0627\u0631\u0633\u0627\u0644\u06CC \u06CC\u0627 \u0646\u0648\u0639 \u0622\u0646 (MimeType) \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A." });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "\u06A9\u0644\u06CC\u062F API \u0645\u0631\u0628\u0648\u0637 \u0628\u0647 \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06CC (GEMINI_API_KEY) \u062F\u0631 \u0633\u0631\u0648\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F. \u0644\u0637\u0641\u0627\u064B \u062F\u0631 \u0628\u062E\u0634 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0648\u0627\u0631\u062F \u06A9\u0646\u06CC\u062F." });
  }
  try {
    const ai = new import_genai.GoogleGenAI({ apiKey });
    const systemPrompt = `You are an expert Persian task extraction assistant.
Scan the attached file (which is either an image or a PDF document).
Extract all actionable tasks, action points, to-do lists, schedules, or checklist items written in it.
Always return a valid JSON array of objects conforming to the requested schema.
Use Persian language for task titles and notes.
Do not use markdown formatting. Return ONLY raw JSON.

Current context info:
- Today is: ${todayContext || (/* @__PURE__ */ new Date()).toLocaleString("fa-IR")}
- Convert relative dates into the exact Jalali format YYYY/MM/DD based on the provided context (\u0627\u0645\u0631\u0648\u0632).`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            mimeType,
            data: base64
          }
        },
        {
          text: "\u062A\u0645\u0627\u0645\u06CC \u06A9\u0627\u0631\u0647\u0627\u06CC \u0642\u0627\u0628\u0644 \u0627\u0646\u062C\u0627\u0645 \u0648 \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0645\u0648\u062C\u0648\u062F \u062F\u0631 \u0627\u06CC\u0646 \u0633\u0646\u062F/\u062A\u0635\u0648\u06CC\u0631 \u0631\u0627 \u0627\u0633\u062A\u062E\u0631\u0627\u062C \u06A9\u0646."
        }
      ],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.ARRAY,
          description: "List of parsed tasks",
          items: {
            type: import_genai.Type.OBJECT,
            properties: {
              title: { type: import_genai.Type.STRING, description: "Persian title of the task" },
              notes: { type: import_genai.Type.STRING, description: "Persian extra notes or context" },
              priority: {
                type: import_genai.Type.STRING,
                enum: ["low", "medium", "high"],
                description: "Priority of the task"
              },
              category: { type: import_genai.Type.STRING, description: "One of standard categories (\u0634\u062E\u0635\u06CC, \u06A9\u0627\u0631\u06CC, \u062F\u0631\u0633, \u0633\u0644\u0627\u0645\u062A, \u062E\u0631\u06CC\u062F, \u0645\u0627\u0644\u06CC) or a suitable custom Persian category" },
              dueDate: { type: import_genai.Type.STRING, description: "Calculated date in YYYY-MM-DD format" },
              reminderTime: { type: import_genai.Type.STRING, description: "Time of day in HH:MM format" }
            },
            required: ["title", "priority", "category"]
          }
        }
      }
    });
    const textResponse = response.text;
    if (!textResponse) {
      throw new Error("Empty response from Gemini API");
    }
    const tasks = JSON.parse(textResponse.trim());
    res.json({ success: true, tasks });
  } catch (error) {
    console.error("AI Upload File Error:", error);
    res.status(500).json({ error: `\u062E\u0637\u0627 \u062F\u0631 \u067E\u0631\u062F\u0627\u0632\u0634 \u0641\u0627\u06CC\u0644 \u062A\u0648\u0633\u0637 \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06CC: ${error.message || error}` });
  }
});
async function run() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}
run();
//# sourceMappingURL=server.cjs.map
