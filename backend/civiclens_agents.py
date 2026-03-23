"""
civiclens_agents.py — CivicLens Policy Analysis AI
Uses Hugging Face API with Qwen model.
Output format: pros, cons, corrections, score, justification
"""

import os
import re
import json
import time
import logging
from dataclasses import dataclass, field
from typing import List, Optional

from huggingface_hub import InferenceClient
from dotenv import load_dotenv

load_dotenv()

# ── Logging ───────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("CivicLens")

# ── Constants ──────────────────────────────────────────────────────
MODEL        = "Qwen/Qwen2.5-72B-Instruct"
MAX_RETRIES  = 3
RETRY_DELAY  = 2.0


# ── Data class ─────────────────────────────────────────────────────

@dataclass
class AgentResult:
    points:           List[str]
    confidence_score: int


# ── JSON Helpers ───────────────────────────────────────────────────

def _clean_and_parse(raw: str) -> Optional[dict]:
    """Remove markdown fences and parse JSON safely."""
    # Remove ```json ... ``` fences
    cleaned = re.sub(r"```(?:json)?", "", raw, flags=re.IGNORECASE).strip()
    cleaned = cleaned.replace("```", "").strip()

    # Try direct parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Try extracting first {...} block
    match = re.search(r"\{[\s\S]*\}", cleaned)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    logger.warning("JSON parse failed. Raw: %s", raw[:150])
    return None


# ── Main Agent Class ───────────────────────────────────────────────

class CivicLensAgents:
    """
    CivicLens Multi-Agent Policy Analyzer.

    Pipeline:
      1. Pros Agent    → finds positive impacts
      2. Cons Agent    → finds negative impacts
      3. Final Scorer  → generates corrections + score + justification
    """

    def __init__(self):
        api_key = os.getenv("HF_TOKEN")
        if not api_key:
            raise ValueError("HF_TOKEN not found. Add it to your .env file.")
        self.client = InferenceClient(token=api_key)
        self.model  = MODEL
        logger.info("CivicLensAgents ready. Model: %s", self.model)

    # ── LLM Caller ─────────────────────────────────────────────────

    def _call_llm(self, system_prompt: str, user_prompt: str, max_tokens: int = 600, temperature: float = 0.3) -> str:
        """Call Hugging Face API with automatic retry on failure."""
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response = self.client.chat_completion(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user",   "content": user_prompt},
                    ],
                    temperature=0.3,
                    max_tokens=max_tokens,
                    stream=False,
                )
                result = response.choices[0].message.content.strip()
                if result:
                    return result
                logger.warning("Attempt %d: empty response.", attempt)

            except Exception as e:
                wait = RETRY_DELAY * (2 ** (attempt - 1))
                logger.warning("Attempt %d failed: %s. Retrying in %.1fs...", attempt, e, wait)
                if attempt < MAX_RETRIES:
                    time.sleep(wait)

        logger.error("All LLM attempts failed.")
        return ""

    # ── Agent 1: Pros ──────────────────────────────────────────────

    def pros_agent(self, policy: str) -> AgentResult:
        """Identifies positive impacts of the policy."""

        sys_prompt = """You are a Policy Benefits Analyst.
Your job: Find the POSITIVE IMPACTS of the given policy.
Think about: social benefits, economic gains, long-term improvements, who benefits.

Return ONLY this JSON (no markdown, no extra text):
{
  "points": ["positive impact 1", "positive impact 2", "positive impact 3"],
  "confidence_score": 75
}

Rules:
- 3 to 5 points in the list
- Each point is one clear sentence
- confidence_score is a number from 0 to 100
- RETURN JSON ONLY"""

        user_prompt = f"Policy:\n{policy}\n\nPositive impacts JSON:"

        raw    = self._call_llm(sys_prompt, user_prompt, max_tokens=400)
        parsed = _clean_and_parse(raw)

        if parsed and "points" in parsed:
            points = [str(p).strip() for p in parsed["points"] if p]
            conf   = max(0, min(100, int(parsed.get("confidence_score", 60))))
            logger.info("Pros Agent: %d points, confidence=%d%%", len(points), conf)
            return AgentResult(points=points, confidence_score=conf)

        # Fallback: extract lines from raw text
        logger.warning("Pros Agent: JSON parse failed, extracting sentences.")
        lines = [s.strip() for s in raw.split("\n") if len(s.strip()) > 20]
        return AgentResult(points=lines[:4] or ["Could not extract positive impacts."], confidence_score=30)

    # ── Agent 2: Cons ──────────────────────────────────────────────

    def cons_agent(self, policy: str) -> AgentResult:
        """Identifies negative impacts and risks of the policy."""

        sys_prompt = """You are a Policy Risk Analyst.
Your job: Find the NEGATIVE IMPACTS and RISKS of the given policy.
Think about: implementation problems, budget issues, unintended consequences, who gets harmed.

Return ONLY this JSON (no markdown, no extra text):
{
  "points": ["negative impact 1", "negative impact 2", "negative impact 3"],
  "confidence_score": 70
}

Rules:
- 3 to 5 points in the list
- Each point is one clear sentence
- confidence_score is a number from 0 to 100
- RETURN JSON ONLY"""

        user_prompt = f"Policy:\n{policy}\n\nNegative impacts JSON:"

        raw    = self._call_llm(sys_prompt, user_prompt, max_tokens=400)
        parsed = _clean_and_parse(raw)

        if parsed and "points" in parsed:
            points = [str(p).strip() for p in parsed["points"] if p]
            conf   = max(0, min(100, int(parsed.get("confidence_score", 60))))
            logger.info("Cons Agent: %d points, confidence=%d%%", len(points), conf)
            return AgentResult(points=points, confidence_score=conf)

        logger.warning("Cons Agent: JSON parse failed, extracting sentences.")
        lines = [s.strip() for s in raw.split("\n") if len(s.strip()) > 20]
        return AgentResult(points=lines[:4] or ["Could not extract negative impacts."], confidence_score=30)

    # ── Agent 3: Scorer ────────────────────────────────────────────

    def scoring_agent(self, policy: str, pros: AgentResult, cons: AgentResult) -> dict:
        """
        Generates:
        - corrections / improvement suggestions
        - score out of 100
        - justification for the score
        """

        pros_str = "\n".join(f"- {p}" for p in pros.points)
        cons_str = "\n".join(f"- {p}" for p in cons.points)

        sys_prompt = """You are a Senior Policy Evaluation Expert.
You have the positive and negative impacts of a policy.
Your job: Suggest improvements AND give a UNIQUE score for THIS specific policy.

Scoring guide (use this carefully):
- 85-100: Excellent — very strong benefits, minimal risks, easy to implement
- 70-84: Good — benefits outweigh risks, some challenges
- 50-69: Average — mixed results, significant issues exist
- 30-49: Weak — more risks than benefits, major problems
- 0-29: Poor — fundamentally flawed, not recommended

Return ONLY this JSON (no markdown, no extra text):
{
  "corrections": ["suggestion 1", "suggestion 2", "suggestion 3"],
  "score": <YOUR CALCULATED SCORE — never use 72 as default>,
  "justification": "2-3 sentences explaining the score with specific reasons from THIS policy"
}

Rules:
- score MUST vary based on actual pros vs cons balance
- score must be a whole number, calculated fresh each time
- justification must mention specific details from this policy
- corrections: 2 to 4 practical improvement suggestions
- RETURN JSON ONLY"""

        user_prompt = (
            f"Policy:\n{policy}\n\n"
            f"Positive Impacts:\n{pros_str}\n\n"
            f"Negative Impacts:\n{cons_str}\n\n"
            "Corrections, score, and justification JSON:"
        )

        raw    = self._call_llm(sys_prompt, user_prompt, max_tokens=500, temperature=0.2)
        parsed = _clean_and_parse(raw)

        if parsed:
            try:
                score        = max(0, min(100, int(parsed.get("score", 50))))
                corrections  = [str(c).strip() for c in parsed.get("corrections", []) if c]
                justification = str(parsed.get("justification", "")).strip()
                logger.info("Scoring Agent: score=%d", score)
                return {
                    "corrections":    corrections,
                    "score":          score,
                    "justification":  justification,
                    "fallback":       False,
                }
            except (TypeError, ValueError) as e:
                logger.error("Scoring Agent field error: %s", e)

        # Fallback scoring
        logger.warning("Scoring Agent: JSON parse failed. Using fallback scoring.")
        n_pros = len(pros.points)
        n_cons = len(cons.points)
        score  = max(0, min(100, 50 + (n_pros * 8) - (n_cons * 8)))
        return {
            "corrections":   ["Re-run analysis for AI-generated suggestions."],
            "score":         score,
            "justification": f"Fallback score based on {n_pros} positive and {n_cons} negative impacts identified.",
            "fallback":      True,
        }

    # ── Main Entry Point ───────────────────────────────────────────

    def run_analysis(self, policy: str) -> dict:
        """
        Runs the full pipeline and returns the final result dict:
        {
            "pros":          [...],
            "cons":          [...],
            "corrections":   [...],
            "score":         80,
            "justification": "..."
        }
        """
        if not policy or not policy.strip():
            raise ValueError("Policy text cannot be empty.")

        policy = policy.strip()
        start  = time.perf_counter()

        logger.info("=== Step 1: Pros Agent ===")
        pros = self.pros_agent(policy)

        logger.info("=== Step 2: Cons Agent ===")
        cons = self.cons_agent(policy)

        logger.info("=== Step 3: Scoring Agent ===")
        scoring = self.scoring_agent(policy, pros, cons)

        total_time = time.perf_counter() - start
        logger.info("=== Analysis complete in %.2fs | Score: %d/100 ===", total_time, scoring["score"])

        return {
            "pros":          pros.points,
            "cons":          cons.points,
            "corrections":   scoring["corrections"],
            "score":         scoring["score"],
            "justification": scoring["justification"],
        }


# ── Quick CLI Test ─────────────────────────────────────────────────

if __name__ == "__main__":
    agents = CivicLensAgents()

    test_policy = (
        "Introduce free school meals for all students in government schools "
        "across India, funded by a 2% cess on corporate tax."
    )

    print(f"\nPolicy:\n{test_policy}\n")
    print("=" * 60)

    result = agents.run_analysis(test_policy)

    print("\n✅ PROS:")
    for p in result["pros"]:
        print(f"  • {p}")

    print("\n❌ CONS:")
    for c in result["cons"]:
        print(f"  • {c}")

    print("\n🔧 CORRECTIONS:")
    for c in result["corrections"]:
        print(f"  • {c}")

    print(f"\n📊 SCORE: {result['score']} / 100")
    print(f"\n📝 JUSTIFICATION:\n  {result['justification']}")