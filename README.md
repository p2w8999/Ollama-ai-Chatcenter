# 🤖 OllamaGPT

A local AI chat application powered by **Ollama**.  
Run AI models directly on your own PC with a simple ChatGPT-style interface.

No API keys required. Your conversations stay local.

---

# ✨ Features

✅ Chat with local AI models  
✅ Uses Ollama as the AI engine  
✅ Automatic model detection  
✅ Multiple model support  
✅ Local chat history  
✅ Fast and private AI assistant  
✅ Custom web interface  

---

# 📋 Requirements

Before installing OllamaGPT, make sure you have:

## Software

- Windows 10/11 (or Linux)
- Node.js LTS
- Ollama
- Git (optional)

Check Node.js:

```bash
node -v

Check Ollama:

ollama --version
🦙 Install Ollama

Download Ollama:

https://ollama.com/download

After installing, start Ollama.

Test it:

ollama list

If it works, you are ready.

🧠 Recommended AI Models

You do not need many models. Start with these:

⭐ Fast everyday assistant
ollama pull llama3.2:3b

Good for:

Normal chat
Questions
General help

Size:
~2GB

⭐ Coding model
ollama pull qwen2.5-coder:7b

Good for:

Programming
Debugging
Explaining code

Size:
~4-5GB

⭐ Reasoning model
ollama pull deepseek-r1:7b

Good for:

Logic
Math
Problem solving

Size:
~4-5GB

⭐ Lightweight model (low-end PCs)
ollama pull llama3.2:1b

Good for:

Fast responses
Small RAM systems

Size:
~1GB

📥 Install OllamaGPT

Clone the project:

git clone YOUR_REPOSITORY_LINK

Open the folder:

cd OllamaGPT

Install packages:

npm install
▶️ Start OllamaGPT

Make sure Ollama is running.

Start the server:

node server.js

You should see:

Server running on port 3000

Open your browser:

http://localhost:3000
📁 Project Structure
OllamaGPT
│
├── server.js          # Backend server
├── package.json       # Node dependencies
├── package-lock.json
│
├── public
│   ├── index.html     # Main app
│   ├── style.css
│   └── script.js
│
└── database.db        # Chat storage
🔧 Troubleshooting
Ollama models not showing

Run:

ollama list

If empty, install a model:

ollama pull llama3.2:3b

Restart OllamaGPT.

Ollama connection error

Make sure Ollama is running:

ollama serve

Default Ollama address:

http://localhost:11434
Missing node_modules

If you deleted node_modules:

Run:

npm install

It will restore everything.

🔄 Updating Models

See installed models:

ollama list

Download new models:

ollama pull MODEL_NAME

Remove models:

ollama rm MODEL_NAME
💻 Hardware Guide
RAM	Recommended Models
4-8GB	llama3.2:1b, smollm2
8-16GB	llama3.2:3b, qwen2.5:7b
16-32GB	deepseek-r1:7b, qwen2.5-coder:14b
32GB+	larger 14b-32b models
🔒 Privacy

OllamaGPT runs locally.

Your:

chats
models
data

stay on your computer.

No external AI API is required.

❤️ Credits

Built with:

Ollama
Node.js
Express
JavaScript

Enjoy your local AI assistant 🤖
