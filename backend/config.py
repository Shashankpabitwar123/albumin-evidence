"""Configuration stays on the server. Never send secrets to the browser."""

import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env.local")
# Optional explicit path supports local development without copying credentials.
if os.getenv("ENV_FILE"):
    load_dotenv(os.environ["ENV_FILE"])
DATA = Path(os.getenv("DATA_DIR", str(ROOT / "runtime")))
DATA.mkdir(parents=True, exist_ok=True)
DB = DATA / "evidence.db"
MODEL = os.getenv("OPENAI_MODEL", "gpt-5.4-mini")
BUDGET = float(os.getenv("AI_BUDGET_USD", "5"))
MAX_BYTES = 12 * 1024 * 1024
MAX_PAGES = 40
PROMPT_VERSION = "2026-10-06-v5"
CRITERIA = """Adults aged 18+ with cirrhosis and ascites; repeated scheduled albumin
intended for outpatient maintenance plus standard medical therapy. Initial hospital
admission is allowed if scheduled treatment continues after discharge. Acute inpatient
rescue alone is outside scope. Require a concurrent standard-care or placebo comparator.
Include randomized trials and comparative prospective or retrospective cohorts.
Exclude single-arm series, reviews, editorials and non-human studies.
No publication-year, country, dose or duration threshold is specified.
Combination therapy needs explicit reviewer attention: do not automatically exclude it,
but never attribute its combined effect to albumin alone."""
