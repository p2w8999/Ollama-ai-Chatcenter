// ======================================================
// OllamaGPT Server
// Version 1.0
// Part 1A
// ======================================================

const express = require("express");
const session = require("express-session");
const cors = require("cors");
const bcrypt = require("bcrypt");
const axios = require("axios");
const Database = require("better-sqlite3");
const { v4: uuid } = require("uuid");
const path = require("path");

const app = express();
const PORT = 3000;

const db = new Database("database.db");

const OLLAMA_URL = "http://localhost:11434";

app.use(cors());

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: "CHANGE_THIS_SECRET",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}));

app.use(express.static(path.join(__dirname, "public")));


// ======================================================
// DATABASE
// ======================================================

db.prepare(`
CREATE TABLE IF NOT EXISTS users (
id TEXT PRIMARY KEY,
username TEXT UNIQUE,
password TEXT,
role TEXT,
tokens INTEGER DEFAULT 1000,
created INTEGER
)
`).run();

try {
    db.prepare(`ALTER TABLE users ADD COLUMN omnirouteApiKey TEXT`).run();
} catch (e) {
    // Column already exists
}

db.prepare(`
CREATE TABLE IF NOT EXISTS chats (

id TEXT PRIMARY KEY,

userId TEXT,

title TEXT,

created INTEGER

)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS messages (

id TEXT PRIMARY KEY,

chatId TEXT,

role TEXT,

content TEXT,

created INTEGER

)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS settings (

key TEXT PRIMARY KEY,

value TEXT

)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS usage_logs (

id TEXT PRIMARY KEY,

userId TEXT,

model TEXT,

cost INTEGER,

created INTEGER

)
`).run();


// ======================================================
// DEFAULT MODEL COSTS
// ======================================================

const DEFAULT_MODEL_COSTS = {

    "llama3.2:1b": 1,

    "gemma3:1b": 1,

    "smollm2:1.7b": 2,

    "qwen2.5:1.5b": 2,

    "deepseek-r1:1.5b": 3,

    "phi4-mini": 4,

    "qwen3:4b": 5,

    "gemma3:4b": 5,

    "mistral:7b": 7,

    "qwen2.5-coder:7b": 8,

    "llama3.1:8b": 10,

    "qwen3-coder:30b": 30

};


// ======================================================
// CREATE ADMIN
// ======================================================

const admin = db.prepare(
    "SELECT * FROM users WHERE username=?"
).get("admin");

if (!admin) {

    const hash = bcrypt.hashSync("admin", 10);

    db.prepare(`
INSERT INTO users
VALUES
(
?,
?,
?,
?,
?,
?
)
`).run(

        uuid(),

        "admin",

        hash,

        "admin",

        999999999,

        Date.now()

    );

    console.log("================================");
    console.log("Admin created");
    console.log("Username: admin");
    console.log("Password: admin");
    console.log("PLEASE CHANGE THE PASSWORD");
    console.log("================================");

}


// ======================================================
// HELPERS
// ======================================================

function requireLogin(req, res, next) {

    if (!req.session.user) {

        return res.status(401).json({

            success: false,

            message: "Not logged in"

        });

    }

    next();

}

function requireAdmin(req, res, next) {

    if (!req.session.user) {

        return res.status(401).json({

            success: false

        });

    }

    if (req.session.user.role !== "admin") {

        return res.status(403).json({

            success: false

        });

    }

    next();

}

function getUser() {

    return db.prepare(

        "SELECT * FROM users WHERE id=?"

    );

}

function saveUsage(userId, model, cost) {

    db.prepare(`
INSERT INTO usage_logs
VALUES
(
?,
?,
?,
?,
?
)
`).run(

        uuid(),

        userId,

        model,

        cost,

        Date.now()

    );

}

console.log("Database Ready");
// ======================================================
// AUTH ROUTES
// ======================================================

app.post("/api/login", async (req, res) => {

    const { username, password } = req.body;

    if (!username || !password) {
        return res.json({
            success: false,
            message: "Missing username or password"
        });
    }

    const user = db.prepare(
        "SELECT * FROM users WHERE username=?"
    ).get(username);

    if (!user) {
        return res.json({
            success: false,
            message: "Invalid username or password"
        });
    }

    const ok = await bcrypt.compare(password, user.password);

    if (!ok) {
        return res.json({
            success: false,
            message: "Invalid username or password"
        });
    }

    req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role
    };

    res.json({
        success: true,
        user: {
            username: user.username,
            role: user.role,
            tokens: user.tokens
        }
    });

});

app.post("/api/logout", (req, res) => {

    req.session.destroy(() => {

        res.json({
            success: true
        });

    });

});

app.post("/api/register", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password || username.trim().length < 3 || password.length < 4) {
        return res.json({
            success: false,
            message: "Username must be at least 3 chars and password at least 4 chars."
        });
    }

    const existing = db.prepare("SELECT id FROM users WHERE username=?").get(username.trim());
    if (existing) {
        return res.json({
            success: false,
            message: "Username is already taken."
        });
    }

    const hash = await bcrypt.hash(password, 10);
    const userId = uuid();
    const defaultTokens = 1000;

    db.prepare(`
        INSERT INTO users (id, username, password, role, tokens, created)
        VALUES (?, ?, ?, 'user', ?, ?)
    `).run(userId, username.trim(), hash, defaultTokens, Date.now());

    req.session.user = {
        id: userId,
        username: username.trim(),
        role: "user"
    };

    res.json({
        success: true,
        user: {
            username: username.trim(),
            role: "user",
            tokens: defaultTokens
        }
    });
});

app.post("/api/shop/buy", requireLogin, (req, res) => {
    const { packageId, promoCode } = req.body;
    let tokensToAdd = 0;
    let costDesc = "";

    if (promoCode) {
        const code = promoCode.trim().toUpperCase();
        if (code === "FREE5000" || code === "OLLAMA" || code === "WELCOME") {
            tokensToAdd = 5000;
            costDesc = "Promo Code Redeemed!";
        } else if (code === "BOOST10000") {
            tokensToAdd = 10000;
            costDesc = "Bonus Promo Code Redeemed!";
        } else {
            return res.json({ success: false, message: "Invalid or expired promo code!" });
        }
    } else {
        switch (packageId) {
            case "starter":
                tokensToAdd = 5000;
                costDesc = "$4.99 Starter Pack";
                break;
            case "pro":
                tokensToAdd = 25000;
                costDesc = "$14.99 Pro Pack";
                break;
            case "ultra":
                tokensToAdd = 100000;
                costDesc = "$49.99 Ultra Pack";
                break;
            default:
                tokensToAdd = 2000;
                costDesc = "Refill Pack";
        }
    }

    db.prepare("UPDATE users SET tokens = tokens + ? WHERE id = ?").run(tokensToAdd, req.session.user.id);
    const updatedUser = db.prepare("SELECT tokens FROM users WHERE id = ?").get(req.session.user.id);

    res.json({
        success: true,
        message: `Successfully added ${tokensToAdd.toLocaleString()} tokens! (${costDesc})`,
        tokens: updatedUser.tokens
    });
});

app.post("/api/user/omniroute-key", requireLogin, (req, res) => {
    const { apiKey } = req.body;
    db.prepare("UPDATE users SET omnirouteApiKey=? WHERE id=?").run(apiKey ? apiKey.trim() : null, req.session.user.id);
    res.json({ success: true, message: "OmniRoute API Key updated!" });
});

app.get("/api/me", requireLogin, (req, res) => {

    const user = db.prepare(
        "SELECT id,username,role,tokens,omnirouteApiKey FROM users WHERE id=?"
    ).get(req.session.user.id);

    res.json(user);

});

app.get("/api/online-models", requireLogin, async (req, res) => {
    const user = db.prepare("SELECT omnirouteApiKey FROM users WHERE id=?").get(req.session.user.id);
    const apiKey = (user && user.omnirouteApiKey) ? user.omnirouteApiKey : process.env.OMNIROUTE_API_KEY;

    const defaultOnlineModels = [
        { id: "omniroute/gpt-4o", name: "GPT-4o (OmniRoute)", provider: "OpenAI", cost: 10 },
        { id: "omniroute/gpt-4o-mini", name: "GPT-4o Mini (OmniRoute)", provider: "OpenAI", cost: 3 },
        { id: "omniroute/claude-3-5-sonnet", name: "Claude 3.5 Sonnet (OmniRoute)", provider: "Anthropic", cost: 12 },
        { id: "omniroute/gemini-1.5-pro", name: "Gemini 1.5 Pro (OmniRoute)", provider: "Google", cost: 8 },
        { id: "omniroute/deepseek-v3", name: "DeepSeek V3 (OmniRoute)", provider: "DeepSeek", cost: 5 }
    ];

    if (!apiKey) {
        return res.json({
            hasKey: false,
            models: defaultOnlineModels
        });
    }

    try {
        const response = await axios.get("http://localhost:2080/v1/models", {
            headers: { Authorization: `Bearer ${apiKey}` },
            timeout: 3000
        });
        if (response.data && response.data.data) {
            const fetched = response.data.data.map(m => ({
                id: m.id,
                name: m.id + " (OmniRoute)",
                provider: "OmniRoute",
                cost: 8
            }));
            return res.json({ hasKey: true, models: fetched.length ? fetched : defaultOnlineModels });
        }
    } catch (e) {
        // Fallback to defaults
    }

    res.json({ hasKey: true, models: defaultOnlineModels });
});


// ======================================================
// ADMIN USER MANAGEMENT
// ======================================================

app.get("/api/admin/users", requireAdmin, (req, res) => {

    const users = db.prepare(`
        SELECT
        id,
        username,
        role,
        tokens,
        created
        FROM users
        ORDER BY created DESC
    `).all();

    res.json(users);

});

app.post("/api/admin/users", requireAdmin, async (req, res) => {

    const {
        username,
        password,
        role = "user",
        tokens = 1000
    } = req.body;

    if (!username || !password) {

        return res.json({
            success: false,
            message: "Missing fields"
        });

    }

    const exists = db.prepare(
        "SELECT id FROM users WHERE username=?"
    ).get(username);

    if (exists) {

        return res.json({
            success: false,
            message: "Username already exists"
        });

    }

    const hash = await bcrypt.hash(password, 10);

    db.prepare(`
        INSERT INTO users
        VALUES
        (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?
        )
    `).run(

        uuid(),
        username,
        hash,
        role,
        tokens,
        Date.now()

    );

    res.json({
        success: true
    });

});

app.put("/api/admin/users/:id/tokens", requireAdmin, (req, res) => {

    const { tokens } = req.body;

    db.prepare(`
        UPDATE users
        SET tokens=?
        WHERE id=?
    `).run(tokens, req.params.id);

    res.json({
        success: true
    });

});

app.delete("/api/admin/users/:id", requireAdmin, (req, res) => {

    db.prepare(
        "DELETE FROM users WHERE id=?"
    ).run(req.params.id);

    res.json({
        success: true
    });

});


// ======================================================
// MODEL COSTS
// ======================================================

app.get("/api/model-costs", (req, res) => {

    res.json(DEFAULT_MODEL_COSTS);

});

app.post("/api/admin/model-costs", requireAdmin, (req, res) => {

    Object.assign(DEFAULT_MODEL_COSTS, req.body);

    res.json({
        success: true
    });

});


// ======================================================
// OLLAMA MODELS
// ======================================================

app.get("/api/models", requireLogin, async (req, res) => {

    try {

        const response = await axios.get(
            `${OLLAMA_URL}/api/tags`
        );

        res.json(response.data.models || []);

    } catch (err) {

        res.status(500).json({
            success: false,
            message: "Ollama is not running."
        });

    }

});
// ======================================================
// CHAT API
// ======================================================

app.get("/api/chats", requireLogin, (req, res) => {

    const chats = db.prepare(`
        SELECT *
        FROM chats
        WHERE userId=?
        ORDER BY created DESC
    `).all(req.session.user.id);

    res.json(chats);

});

app.post("/api/chats", requireLogin, (req, res) => {

    const id = uuid();

    db.prepare(`
        INSERT INTO chats
        VALUES
        (
        ?,
        ?,
        ?,
        ?
        )
    `).run(

        id,
        req.session.user.id,
        "New Chat",
        Date.now()

    );

    res.json({
        success: true,
        id
    });

});

app.get("/api/chats/:id/messages", requireLogin, (req, res) => {

    const messages = db.prepare(`
        SELECT role,content,created
        FROM messages
        WHERE chatId=?
        ORDER BY created ASC
    `).all(req.params.id);

    res.json(messages);

});

app.delete("/api/chats/:id", requireLogin, (req, res) => {

    db.prepare(
        "DELETE FROM messages WHERE chatId=?"
    ).run(req.params.id);

    db.prepare(
        "DELETE FROM chats WHERE id=?"
    ).run(req.params.id);

    res.json({
        success: true
    });

});


// ======================================================
// SAVE MESSAGE
// ======================================================

function saveMessage(chatId, role, content) {

    db.prepare(`
        INSERT INTO messages
        VALUES
        (
        ?,
        ?,
        ?,
        ?,
        ?
        )
    `).run(

        uuid(),
        chatId,
        role,
        content,
        Date.now()

    );

}


// ======================================================
// AUTO CHAT TITLE
// ======================================================

function updateChatTitle(chatId, message) {

    const title = message
        .replace(/\n/g, " ")
        .trim()
        .substring(0, 40);

    db.prepare(`
        UPDATE chats
        SET title=?
        WHERE id=?
    `).run(title || "New Chat", chatId);

}


// ======================================================
// TOKEN COST
// ======================================================

function getModelCost(model) {

    return DEFAULT_MODEL_COSTS[model] || 5;

}

function deductTokens(userId, amount) {

    db.prepare(`
        UPDATE users
        SET tokens=tokens-?
        WHERE id=?
    `).run(amount, userId);

}

function getTokens(userId) {

    return db.prepare(`
        SELECT tokens
        FROM users
        WHERE id=?
    `).get(userId).tokens;

}
// ======================================================
// CHAT WITH OLLAMA (STREAMING)
// ======================================================

app.post("/api/chat", requireLogin, async (req, res) => {

    try {

        const {
            chatId,
            message,
            model,
            system = "",
            temperature = 0.7,
            context = 4096
        } = req.body;

        if (!chatId || !message || !model) {

            return res.status(400).json({
                success: false,
                message: "Missing required fields."
            });

        }

        const cost = getModelCost(model);
        const tokens = getTokens(req.session.user.id);

        if (tokens < cost) {

            return res.status(403).json({
                success: false,
                message: "Not enough tokens."
            });

        }

        saveMessage(chatId, "user", message);

        const chat = db.prepare(`
            SELECT title
            FROM chats
            WHERE id=?
        `).get(chatId);

        if (chat && chat.title === "New Chat") {
            updateChatTitle(chatId, message);
        }

        const history = db.prepare(`
            SELECT role,content
            FROM messages
            WHERE chatId=?
            ORDER BY created ASC
        `).all(chatId);

        const messages = [];

        if (system.trim() !== "") {
            messages.push({
                role: "system",
                content: system
            });
        }

        history.forEach(m => {

            messages.push({
                role: m.role,
                content: m.content
            });

        });

        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Transfer-Encoding", "chunked");
        res.setHeader("Cache-Control", "no-cache");

        // CHECK IF OMNIROUTE ONLINE MODEL
        if (model.startsWith("omniroute/")) {
            const user = db.prepare("SELECT omnirouteApiKey FROM users WHERE id=?").get(req.session.user.id);
            const apiKey = (user && user.omnirouteApiKey) ? user.omnirouteApiKey : process.env.OMNIROUTE_API_KEY;

            if (!apiKey) {
                res.write("Error: OmniRoute API key is not configured. Please add your key in settings/model tab.");
                return res.end();
            }

            const cleanModel = model.replace("omniroute/", "");
            let fullResponse = "";

            try {
                const response = await axios({
                    method: "post",
                    url: "http://localhost:2080/v1/chat/completions",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/json"
                    },
                    responseType: "stream",
                    data: {
                        model: cleanModel,
                        messages,
                        stream: true,
                        temperature
                    }
                });

                response.data.on("data", chunk => {
                    const lines = chunk.toString().split("\n");
                    for (const line of lines) {
                        if (line.startsWith("data: ") && line !== "data: [DONE]") {
                            try {
                                const json = JSON.parse(line.substring(6));
                                const text = json.choices?.[0]?.delta?.content;
                                if (text) {
                                    fullResponse += text;
                                    res.write(text);
                                }
                            } catch (e) {}
                        }
                    }
                });

                response.data.on("end", () => {
                    saveMessage(chatId, "assistant", fullResponse || "Completed.");
                    deductTokens(req.session.user.id, cost);
                    saveUsage(req.session.user.id, model, cost);
                    res.end();
                });

                response.data.on("error", err => {
                    console.error("OmniRoute Stream Error:", err);
                    res.end();
                });
            } catch (err) {
                res.write(`Error connecting to OmniRoute server at http://localhost:2080: ${err.message}`);
                res.end();
            }
            return;
        }

        const response = await axios({

            method: "post",

            url: `${OLLAMA_URL}/api/chat`,

            responseType: "stream",

            data: {

                model,

                stream: true,

                messages,

                options: {

                    temperature,

                    num_ctx: context

                }

            }

        });

        let fullResponse = "";

        response.data.on("data", chunk => {

            const lines = chunk.toString().split("\n");

            for (const line of lines) {

                if (!line.trim()) continue;

                try {

                    const json = JSON.parse(line);

                    if (json.message?.content) {

                        fullResponse += json.message.content;

                        res.write(json.message.content);

                    }

                } catch {

                }

            }

        });

        response.data.on("end", () => {

            saveMessage(chatId, "assistant", fullResponse);

            deductTokens(req.session.user.id, cost);

            saveUsage(
                req.session.user.id,
                model,
                cost
            );

            res.end();

        });

        response.data.on("error", err => {

            console.error(err);

            res.end();

        });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: "Ollama request failed."

        });

    }

});
// ======================================================
// RENAME CHAT
// ======================================================

app.put("/api/chats/:id/title", requireLogin, (req, res) => {

    const { title } = req.body;

    db.prepare(`
        UPDATE chats
        SET title=?
        WHERE id=?
    `).run(title, req.params.id);

    res.json({
        success: true
    });

});


// ======================================================
// CLEAR CHAT
// ======================================================

app.delete("/api/chats/:id/messages", requireLogin, (req, res) => {

    db.prepare(`
        DELETE FROM messages
        WHERE chatId=?
    `).run(req.params.id);

    res.json({
        success: true
    });

});


// ======================================================
// SETTINGS
// ======================================================

app.get("/api/settings", requireLogin, (req, res) => {

    const rows = db.prepare(`
        SELECT *
        FROM settings
    `).all();

    const settings = {};

    for (const row of rows) {

        settings[row.key] = row.value;

    }

    res.json(settings);

});

app.post("/api/settings", requireAdmin, (req, res) => {

    for (const key in req.body) {

        db.prepare(`
            INSERT OR REPLACE INTO settings
            VALUES
            (?,?)
        `).run(
            key,
            String(req.body[key])
        );

    }

    res.json({
        success: true
    });

});


// ======================================================
// ADMIN STATS
// ======================================================

app.get("/api/admin/stats", requireAdmin, (req, res) => {

    const users =
        db.prepare("SELECT COUNT(*) total FROM users").get().total;

    const chats =
        db.prepare("SELECT COUNT(*) total FROM chats").get().total;

    const messages =
        db.prepare("SELECT COUNT(*) total FROM messages").get().total;

    const usage =
        db.prepare("SELECT COUNT(*) total FROM usage_logs").get().total;

    res.json({

        users,

        chats,

        messages,

        usage

    });

});


// ======================================================
// USAGE LOGS
// ======================================================

app.get("/api/admin/usage", requireAdmin, (req, res) => {

    const logs = db.prepare(`
        SELECT *
        FROM usage_logs
        ORDER BY created DESC
        LIMIT 500
    `).all();

    res.json(logs);

});


// ======================================================
// ROOT
// ======================================================

app.get("/", (req, res) => {

    res.sendFile(path.join(__dirname, "public", "index.html"));

});

app.get("/admin", (req, res) => {

    res.sendFile(path.join(__dirname, "public", "admin.html"));

});


// ======================================================
// START SERVER
// ======================================================

app.listen(PORT, () => {

    console.log("");
    console.log("======================================");
    console.log("        OllamaGPT Server");
    console.log("======================================");
    console.log("Running: http://localhost:" + PORT);
    console.log("Admin : http://localhost:" + PORT + "/admin");
    console.log("Ollama: " + OLLAMA_URL);
    console.log("======================================");
    console.log("");

});