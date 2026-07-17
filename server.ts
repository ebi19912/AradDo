import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import bcrypt from "bcrypt";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

// Database setup
const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "tasks-db.json");

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

interface SpaceData {
  spaceId: string;
  tasks: EncryptedTask[];
  inbox: SharedTask[];
  updatedAt: number;
}

interface UserAccount {
  username: string;
  passwordHash: string;
  spaceId: string;
  createdAt: number;
}

// In-memory db with file backup
let db: {
  spaces: Record<string, SpaceData>;
  users?: Record<string, UserAccount>;
} = { spaces: {}, users: {} };

function loadDatabase() {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      db = JSON.parse(data);
      if (!db.users) {
        db.users = {};
      }
      console.log("Database loaded successfully with", Object.keys(db.spaces).length, "spaces.");
    } else {
      db.users = {};
      saveDatabase();
    }
  } catch (error) {
    console.error("Failed to load database, starting fresh:", error);
    db.users = {};
  }
}

function saveDatabase() {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save database:", error);
  }
}

// Load database immediately
loadDatabase();

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
app.post("/api/sync/create-space", (req, res) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let spaceId = "SPACE-";
  for (let i = 0; i < 4; i++) spaceId += chars.charAt(Math.floor(Math.random() * chars.length));
  spaceId += "-";
  for (let i = 0; i < 4; i++) spaceId += chars.charAt(Math.floor(Math.random() * chars.length));

  db.spaces[spaceId] = {
    spaceId,
    tasks: [],
    inbox: [],
    updatedAt: Date.now(),
  };
  saveDatabase();

  res.json({ spaceId, success: true });
});

// API: Get tasks for a specific space
app.get("/api/sync/space/:spaceId", (req, res) => {
  const { spaceId } = req.params;
  const space = db.spaces[spaceId];
  if (!space) {
    return res.status(404).json({ error: "Space not found" });
  }
  // Ensure inbox exists for backward compatibility
  if (!space.inbox) {
    space.inbox = [];
  }
  res.json(space);
});

// API: Update tasks for a space and notify other connected devices via SSE
app.post("/api/sync/space/:spaceId/update", (req, res) => {
  const { spaceId } = req.params;
  const { tasks } = req.body;

  if (!Array.isArray(tasks)) {
    return res.status(400).json({ error: "Invalid tasks payload" });
  }

  let space = db.spaces[spaceId];
  if (!space) {
    // Dynamically initialize if client has a pre-existing space ID they want to restore or use
    space = {
      spaceId,
      tasks: [],
      inbox: [],
      updatedAt: Date.now(),
    };
    db.spaces[spaceId] = space;
  }

  space.tasks = tasks.map((t: any) => ({
    id: String(t.id),
    encryptedData: String(t.encryptedData),
    updatedAt: Number(t.updatedAt) || Date.now(),
  }));
  space.updatedAt = Date.now();
  saveDatabase();

  // Notify other SSE clients subscribed to this space
  const senderClientId = req.headers["x-client-id"] as string;
  clients.forEach((client) => {
    if (client.spaceId === spaceId && client.id !== senderClientId) {
      try {
        client.res.write(`data: ${JSON.stringify({ type: "sync", spaceId, updatedAt: space.updatedAt })}\n\n`);
      } catch (err) {
        console.error("Error sending SSE update:", err);
      }
    }
  });

  res.json({ success: true, updatedAt: space.updatedAt });
});

// API: Share an encrypted task to another target space
app.post("/api/sync/space/:spaceId/share", (req, res) => {
  const { spaceId } = req.params; // This is the recipient's space ID
  const { senderSpaceId, encryptedData, taskId } = req.body;

  if (!encryptedData) {
    return res.status(400).json({ error: "encryptedData is required" });
  }

  // Find recipient's space
  let space = db.spaces[spaceId];
  if (!space) {
    return res.status(404).json({ error: "کد فضای مقصد یافت نشد." });
  }

  if (!space.inbox) {
    space.inbox = [];
  }

  const newSharedTask: SharedTask = {
    id: taskId || Math.random().toString(36).substring(7),
    senderSpaceId: senderSpaceId || "ناشناس",
    encryptedData,
    sharedAt: Date.now(),
  };

  space.inbox.push(newSharedTask);
  space.updatedAt = Date.now();
  saveDatabase();

  // Send real-time notification update via SSE to all active connections in the recipient's space
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
});

// API: Remove/accept a shared task from the inbox
app.post("/api/sync/space/:spaceId/inbox/remove", (req, res) => {
  const { spaceId } = req.params;
  const { taskId } = req.body;

  const space = db.spaces[spaceId];
  if (space && space.inbox) {
    space.inbox = space.inbox.filter((t) => t.id !== taskId);
    space.updatedAt = Date.now();
    saveDatabase();
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
  if (!db.users) {
    db.users = {};
  }

  if (db.users[normalized]) {
    return res.status(400).json({ error: "این نام کاربری قبلاً ثبت شده است." });
  }

  // Generate a new space ID
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let spaceId = "SPACE-";
  for (let i = 0; i < 4; i++) spaceId += chars.charAt(Math.floor(Math.random() * chars.length));
  spaceId += "-";
  for (let i = 0; i < 4; i++) spaceId += chars.charAt(Math.floor(Math.random() * chars.length));

  try {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Save the user account
    db.users[normalized] = {
      username: username.trim(),
      passwordHash,
      spaceId,
      createdAt: Date.now()
    };

    // Pre-initialize space
    db.spaces[spaceId] = {
      spaceId,
      tasks: [],
      inbox: [],
      updatedAt: Date.now()
    };

    saveDatabase();

    res.json({ success: true, username: username.trim(), spaceId });
  } catch (error) {
    console.error("Error hashing password:", error);
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
  if (!db.users) {
    db.users = {};
  }

  const user = db.users[normalized];
  if (!user) {
    return res.status(400).json({ error: "نام کاربری یا گذرواژه نادرست است." });
  }

  try {
    const match = await bcrypt.compare(password, user.passwordHash);
    // Backward compatibility for plaintext passwords
    const isLegacyPlaintext = user.passwordHash === password;

    if (!match && !isLegacyPlaintext) {
      return res.status(400).json({ error: "نام کاربری یا گذرواژه نادرست است." });
    }

    if (isLegacyPlaintext) {
        // Upgrade to hashed password immediately
        const saltRounds = 10;
        user.passwordHash = await bcrypt.hash(password, saltRounds);
        saveDatabase();
    }

    res.json({ success: true, username: user.username, spaceId: user.spaceId });
  } catch (error) {
    console.error("Error comparing password:", error);
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
