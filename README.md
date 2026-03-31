# CivicLens

CivicLens is a web application built as a minor project. It analyzes policies — government or organizational — and gives structured feedback using AI.

You enter a policy, and the system tells you what could go right, what could go wrong, how it can be improved, and gives it a score out of 100.

---

## What it does

- Identifies positive impacts of a policy
- Identifies negative impacts and risks
- Suggests corrections and improvements
- Gives an overall score out of 100
- Supports reading results aloud
- Supports Hindi and Telugu language output

---

## Tech used

- Frontend: React.js
- Backend: Python with FastAPI
- AI: Hugging Face API — Qwen 2.5 72B model
- Authentication: Supabase (email and Google login)
- Deployed on: Vercel (frontend) and Render (backend)

---

## How to run locally

1. Clone this repository
2. Go into the backend folder and install dependencies

```
pip install -r requirements.txt
```

3. Create a `.env` file in the backend folder and add your Hugging Face token

```
HF_TOKEN=your_token_here
```

4. Start the backend server

```
python -m uvicorn main:app --host 0.0.0.0 --port 5000
```

5. Open `frontend/index.html` using Live Server in VS Code

---

## Project structure

```
civiclens/
  backend/
    main.py
    civiclens_agents.py
    requirements.txt
    .env
  frontend/
    index.html
    login.html
    app.html
    supabase.js
  README.md
```

---

## Team

- P. Sai Keerthana — Project Lead
- P. Monisha — Research and Analysis
- Neha Balaji Jagatkar — Documentation and Reporting

---

Academic Minor Project — 2026