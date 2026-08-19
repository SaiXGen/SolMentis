# MindGuard AI — Multimodal Wellness Companion

A hackathon MVP combining a browser camera, facial-expression cues, text sentiment, mood history, and wellness suggestions.

## MVP
- Camera preview and face detection in the browser
- Lightweight facial-expression cue estimation
- Text sentiment analysis using a Hugging Face model when available
- Combined wellness signal
- Personalized non-medical suggestions
- Local mood history in the browser

## Run

### 1. Backend
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload
```

### 2. Frontend
Open `frontend/index.html` in a browser, or serve it:
```bash
cd frontend
python -m http.server 5500
```
Then visit http://localhost:5500

The browser will ask for camera permission.

## Safety
This is a wellness-support prototype, not a medical diagnostic tool. Facial-expression estimates are imperfect and should never be treated as a diagnosis. The MVP does not automatically contact emergency services or other people.
