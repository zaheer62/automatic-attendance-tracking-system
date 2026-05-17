# infra/ml — Face Recognition ML Layer

This folder is the **ML core** for the attendance system.  
It keeps the face recognition logic separate from the FastAPI backend and the kiosk app, so both can import it cleanly.

---

## Files

| File | Purpose |
|---|---|
| `train.py` | Reads embeddings from PostgreSQL → normalises → saves to `models/face_embeddings.pkl` |
| `recognize.py` | Loads `models/face_embeddings.pkl` → matches query face → returns `(student_id, confidence)` |
| `models/` | Auto-created on first train. Stores `.pkl` embedding file. **Do not commit to git.** |
| `requirements.txt` | Python dependencies for this layer only |
| `.env.example` | Copy to `.env` and fill in `DATABASE_URL` + `CONFIDENCE_THRESHOLD` |

---

## Setup

```bash
cd infra/ml
cp .env.example .env        # fill in DATABASE_URL
pip install -r requirements.txt
```

---

## Workflow

### 1. Students register their faces (via the FastAPI API)
The backend `routers/face.py` already handles this — it calls `face_service.py`
which saves raw embeddings to the `face_embeddings` table in PostgreSQL.

### 2. Train (pull from DB → save to disk)
```bash
python train.py
```
- Reads all rows from `face_embeddings` table
- L2-normalises each embedding vector
- Saves everything to `models/face_embeddings.pkl`
- Re-run any time a new student registers

Force overwrite if file already exists:
```bash
python train.py --force
```

### 3. Recognise a face (standalone test)
```bash
python recognize.py --image /path/to/test.jpg
```

Output:
```
✅  MATCH — student_id=42, confidence=0.8731
```
or
```
❌  NO MATCH — best confidence=0.6120 (threshold=0.80)
```

Adjust the threshold:
```bash
python recognize.py --image test.jpg --threshold 0.75
```

---

## How it works

Both `train.py` and `recognize.py` use the same pipeline:

1. **Haar cascade** detects the face bounding box in a grayscale frame
2. **Crop + resize** to 100×100 px
3. **Histogram equalisation** — normalises brightness/contrast differences
4. **Flatten** → 10 000-dim float32 vector
5. **L2 normalise** → cosine similarity = dot product (fast, no division at query time)

`recognize.py` computes the dot product between the query embedding and every stored embedding, picks the highest score, and returns a match only if the score ≥ `CONFIDENCE_THRESHOLD`.

---

## Used by

- **`infra/kiosk/main.py`** — imports `recognize.recognize_from_frame()` for live camera feed
- **`backend/app/face_service.py`** — can import `recognize.recognize_from_bytes()` for API-triggered recognition

---

## Notes

- `models/face_embeddings.pkl` should be in `.gitignore` — it contains biometric data
- Re-train after every new face registration for the kiosk to pick it up
- The kiosk calls `reload_embeddings()` on a schedule to pick up new registrations without restarting
