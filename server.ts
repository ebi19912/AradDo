import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: "15mb" }));

interface EncryptedTask {
  id: string;
  encryptedData: string; // E2EE payload containing title, notes, category, priority, status, dates, etc.
  updatedAt: number;
}

interface SharedTask {
  id: string;
  senderSpaceId: string;
  encryptedData: string;
  sharedAt: number;
}

// We will keep a local map for inbox for backward compatibility with the frontend structure
// while the rest migrates to SQLite ORM
const dbInbox: Record<string, SharedTask[]> = {};

// SSE Clients Registry
interface SSEClient {
  id: string;
  spaceId: string;
  res: any;
}
let clients: SSEClient[] = [];

// API: Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// API: Generate a new Sync Space ID (e.g. SPACE-XXXX-XXXX)
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

// API: Get tasks for a specific space
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

    // We return mapped tasks keeping the structure client expects
    const mappedTasks = space.tasks.map(t => ({
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

// API: Update tasks for a space and notify other connected devices via SSE
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

    // We store the encrypted E2EE blob into 'notes' and a dummy title to make it work
    for (const t of tasks) {
        await prisma.task.upsert({
            where: { id: t.id },
            create: {
                id: t.id,
                spaceId: space.id,
                title: 'Encrypted Task',
                notes: t.encryptedData || t.data || '',
            },
            update: {
                notes: t.encryptedData || t.data || '',
            }
        });
    }

    const updatedAt = Date.now();

    // Notify other SSE clients subscribed to this space
    const senderClientId = req.headers["x-client-id"] as string;
    clients.forEach((client) => {
      if (client.spaceId === spaceId && client.id !== senderClientId) {
        try {
          client.res.write(`data: ${JSON.stringify({ type: "sync", spaceId, updatedAt })}\n\n`);
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

// API: Share an encrypted task to another target space
app.post("/api/sync/space/:spaceId/share", async (req, res) => {
  const { spaceId } = req.params; // This is the recipient's space ID
  const { senderSpaceId, encryptedData, taskId } = req.body;

  if (!encryptedData) {
    return res.status(400).json({ error: "encryptedData is required" });
  }

  try {
    const space = await prisma.space.findUnique({ where: { id: spaceId } });
    if (!space) {
      return res.status(404).json({ error: "کد فضای مقصد یافت نشد." });
    }

    if (!dbInbox[spaceId]) {
      dbInbox[spaceId] = [];
    }

    const newSharedTask: SharedTask = {
      id: taskId || Math.random().toString(36).substring(7),
      senderSpaceId: senderSpaceId || "ناشناس",
      encryptedData,
      sharedAt: Date.now(),
    };

    dbInbox[spaceId].push(newSharedTask);

    // Push realtime notification to the recipient's space
    clients.forEach((client) => {
      if (client.spaceId === spaceId) {
        try {
          client.res.write(
            `data: ${JSON.stringify({
              type: "share",
              spaceId,
              senderSpaceId: senderSpaceId || "ناشناس",
              sharedTask: newSharedTask,
            })}\n\n`
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

// API: Remove/accept a shared task from the inbox
app.post("/api/sync/space/:spaceId/inbox/remove", (req, res) => {
  const { spaceId } = req.params;
  const { taskId } = req.body;

  if (dbInbox[spaceId]) {
    dbInbox[spaceId] = dbInbox[spaceId].filter((t) => t.id !== taskId);
  }

  res.json({ success: true });
});

// API: SSE Subscription for Real-time Cloud Sync & Notifications
app.get("/api/sync/subscribe", (req, res) => {
  const spaceId = req.query.spaceId as string;
  const clientId = req.query.clientId as string;

  if (!spaceId) {
    return res.status(400).json({ error: "spaceId is required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const client: SSEClient = {
    id: clientId || Math.random().toString(36).substring(7),
    spaceId,
    res,
  };

  clients.push(client);

  // Send initial ping/ack
  res.write(`data: ${JSON.stringify({ type: "connected", clientId: client.id })}\n\n`);

  req.on("close", () => {
    clients = clients.filter((c) => c.id !== client.id);
  });
});

// API: Auth Register
app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "نام کاربری و گذرواژه الزامی هستند." });
  }

  const normalized = username.trim().toLowerCase();

  try {
    const existingUser = await prisma.user.findUnique({ where: { username: normalized } });

    if (existingUser) {
      return res.status(400).json({ error: "این نام کاربری قبلاً ثبت شده است." });
    }

    // Generate a new space ID
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let spaceId = "SPACE-";
    for (let i = 0; i < 4; i++) spaceId += chars.charAt(Math.floor(Math.random() * chars.length));
    spaceId += "-";
    for (let i = 0; i < 4; i++) spaceId += chars.charAt(Math.floor(Math.random() * chars.length));

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

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

// API: Auth Login
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "وارد کردن نام کاربری و گذرواژه الزامی است." });
  }

  const normalized = username.trim().toLowerCase();

  try {
    const user = await prisma.user.findUnique({ where: { username: normalized } });

    if (!user) {
      return res.status(400).json({ error: "نام کاربری یا گذرواژه نادرست است." });
    }

    const match = await bcrypt.compare(password, user.passwordHash);

    // Backward compatibility for plaintext passwords
    const isLegacyPlaintext = user.passwordHash === password;

    if (!match && !isLegacyPlaintext) {
      return res.status(400).json({ error: "نام کاربری یا گذرواژه نادرست است." });
    }

    if (isLegacyPlaintext) {
        // Upgrade to hashed password immediately
        const saltRounds = 10;
        await prisma.user.update({
            where: { username: normalized },
            data: { passwordHash: await bcrypt.hash(password, saltRounds) }
        });
    }

    res.json({ success: true, username: user.username, spaceId: user.spaceId });
  } catch (error) {
    console.error("Error in login:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// API: AI Task Parsing from Natural Language text input
app.post("/api/ai/parse-task", async (req, res) => {
  const { prompt, todayContext } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "متن درخواست هوش مصنوعی نمی‌تواند خالی باشد." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "کلید API مربوط به هوش مصنوعی (GEMINI_API_KEY) در سرور یافت نشد. لطفاً در بخش تنظیمات وارد کنید." });
  }

  try {
    // Lazy load GoogleGenAI as required by Guidelines
    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are an expert Persian task extraction assistant.
Extract lists of individual tasks, reminders, and action items from the user's input.
Always return a valid JSON array of objects conforming to the requested schema.
Use Persian language for task titles and notes.
Do not use markdown formatting in your response. Return ONLY raw JSON.

Current context info:
- Today is: ${todayContext || new Date().toLocaleString("fa-IR")}
- Use this context to resolve relative dates like "فردا" (tomorrow), "شنبه" (Saturday), "پس‌فردا", "آخر هفته", etc., into the exact Jalali format YYYY/MM/DD based on the provided context (امروز).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `متن کاربر برای استخراج تسک‌ها: "${prompt}"`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "List of parsed tasks",
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Persian title of the task" },
              notes: { type: Type.STRING, description: "Persian extra notes, descriptions or contexts of the task" },
              priority: {
                type: Type.STRING,
                enum: ["low", "medium", "high"],
                description: "Priority of the task based on importance keywords used"
              },
              category: { type: Type.STRING, description: "One of standard categories (شخصی, کاری, درس, سلامت, خرید, مالی) or a suitable custom Persian category" },
              dueDate: { type: Type.STRING, description: "Calculated date in YYYY-MM-DD format" },
              reminderTime: { type: Type.STRING, description: "Extracted time of day in HH:MM format" }
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
  } catch (error: any) {
    console.error("AI Parse Task Error:", error);
    res.status(500).json({ error: `خطا در پردازش هوش مصنوعی: ${error.message || error}` });
  }
});

// API: AI Task Extraction from PDF or Image Uploads
app.post("/api/ai/upload-file", async (req, res) => {
  const { base64, mimeType, todayContext } = req.body;
  if (!base64 || !mimeType) {
    return res.status(400).json({ error: "فایل ارسالی یا نوع آن (MimeType) نامعتبر است." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "کلید API مربوط به هوش مصنوعی (GEMINI_API_KEY) در سرور یافت نشد. لطفاً در بخش تنظیمات وارد کنید." });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are an expert Persian task extraction assistant.
Scan the attached file (which is either an image or a PDF document).
Extract all actionable tasks, action points, to-do lists, schedules, or checklist items written in it.
Always return a valid JSON array of objects conforming to the requested schema.
Use Persian language for task titles and notes.
Do not use markdown formatting. Return ONLY raw JSON.

Current context info:
- Today is: ${todayContext || new Date().toLocaleString("fa-IR")}
- Convert relative dates into the exact Jalali format YYYY/MM/DD based on the provided context (امروز).`;

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
          text: "تمامی کارهای قابل انجام و تسک‌های موجود در این سند/تصویر را استخراج کن."
        }
      ],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "List of parsed tasks",
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Persian title of the task" },
              notes: { type: Type.STRING, description: "Persian extra notes or context" },
              priority: {
                type: Type.STRING,
                enum: ["low", "medium", "high"],
                description: "Priority of the task"
              },
              category: { type: Type.STRING, description: "One of standard categories (شخصی, کاری, درس, سلامت, خرید, مالی) or a suitable custom Persian category" },
              dueDate: { type: Type.STRING, description: "Calculated date in YYYY-MM-DD format" },
              reminderTime: { type: Type.STRING, description: "Time of day in HH:MM format" }
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
  } catch (error: any) {
    console.error("AI Upload File Error:", error);
    res.status(500).json({ error: `خطا در پردازش فایل توسط هوش مصنوعی: ${error.message || error}` });
  }
});

// Serve frontend application
async function run() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

run();
