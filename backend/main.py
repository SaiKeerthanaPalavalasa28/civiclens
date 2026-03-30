"""
main.py — CivicLens FastAPI Backend
Run with: python main.py
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from civiclens_agents import CivicLensAgents

app = FastAPI(title="CivicLens API", version="1.0.0")

# Allow frontend to call this backend (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "https://civiclens-ivory.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load agents once at startup — not on every request
agents = CivicLensAgents()


class PolicyRequest(BaseModel):
    policy: str


@app.get("/health")
def health():
    """Quick check that the server is running."""
    return {"status": "ok", "message": "CivicLens backend is running!"}


@app.post("/analyze")
async def analyze(request: PolicyRequest):
    """
    Accepts a policy text and returns:
    {
        "pros":          ["...", "..."],
        "cons":          ["...", "..."],
        "corrections":   ["...", "..."],
        "score":         80,
        "justification": "..."
    }
    """
    policy = request.policy.strip()

    # Basic validation
    if not policy:
        raise HTTPException(status_code=400, detail="Policy text cannot be empty.")
    if len(policy) < 20:
        raise HTTPException(status_code=400, detail="Policy is too short. Please describe it in more detail.")
    if len(policy) > 5000:
        raise HTTPException(status_code=400, detail="Policy is too long (max 5000 characters).")

    try:
        result = agents.run_analysis(policy)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)