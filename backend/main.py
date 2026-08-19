from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import pipeline

app = FastAPI(title="MindGuard AI API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Loaded lazily so the API can still start if the model is unavailable.
sentiment_model = None

class AnalyzeRequest(BaseModel):
    text: str
    face_emotion: str = "neutral"

def get_model():
    global sentiment_model
    if sentiment_model is None:
        sentiment_model = pipeline(
            "sentiment-analysis",
            model="distilbert-base-uncased-finetuned-sst-2-english"
        )
    return sentiment_model

def map_sentiment(label: str, score: float):
    if label.upper() == "NEGATIVE":
        return ("concern", round(score, 3))
    return ("positive", round(score, 3))

@app.get("/health")
def health():
    return {"status": "ok", "service": "MindGuard AI"}

@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    text = req.text.strip()
    if not text:
        return {"emotion": "neutral", "score": 0, "face_emotion": req.face_emotion,
                "suggestion": "Take a moment to check in with yourself."}

    try:
        result = get_model()(text[:512])[0]
        emotion, score = map_sentiment(result["label"], result["score"])
    except Exception:
        # Safe demo fallback if the ML model cannot be downloaded/loaded.
        negative_words = ["stress", "stressed", "sad", "upset", "anxious", "anxiety",
                          "tired", "lonely", "bad", "worried", "overwhelmed"]
        hits = sum(1 for w in negative_words if w in text.lower())
        emotion = "concern" if hits else "neutral"
        score = min(0.95, 0.45 + 0.08 * hits)

    if emotion == "concern" or req.face_emotion in {"sad", "angry", "fear"}:
        suggestion = "Try a 60-second breathing exercise, then consider talking to someone you trust."
    else:
        suggestion = "Keep going with a small positive activity, hydration, movement, or a short break."

    return {
        "emotion": emotion,
        "score": score,
        "face_emotion": req.face_emotion,
        "suggestion": suggestion,
        "disclaimer": "Wellness support only; not a medical diagnosis."
    }
