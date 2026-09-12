"""
AERO ADDICTZ backend
=====================
A small Flask API that powers the AERO ADDICTZ front-end:

  GET  /api/missions   -> mission catalogue (suborbital / orbital / lunar)
  GET  /api/seats       -> seat map + availability
  POST /api/book        -> "book" a seat (in-memory demo store)
  GET  /api/countdown   -> seconds until the next mission
  POST /api/chat        -> Orbi, the AI mission guide

AI integration
---------------
/api/chat will use a real LLM if you provide an API key as an environment
variable, and otherwise falls back to a friendly rule-based "Orbi" so the
whole app still works out of the box with zero configuration.

Supported providers (set ONE of these env vars before running):
  ANTHROPIC_API_KEY   -> uses Claude (model: claude-3-5-haiku-latest by default)
  OPENAI_API_KEY      -> uses OpenAI (model: gpt-4o-mini by default)

Run:
    pip install -r requirements.txt
    python app.py
The API listens on http://localhost:5000 and the front-end (index.html)
already points at that address.
"""

import os
import random
import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # allow the static front-end (opened from file:// or any port) to call this API

# --------------------------------------------------------------------------
# Demo "database" (in memory — resets whenever the server restarts)
# --------------------------------------------------------------------------

MISSIONS = [
    {
        "id": "suborbital",
        "name": "Suborbital Hop",
        "altitude_km": 100,
        "weightlessness_minutes": 6,
        "duration_minutes": 90,
        "status": "booking",
        "description": "A quick, dramatic taste of space — up past the Karman line and gently back down.",
    },
    {
        "id": "orbital",
        "name": "Orbital Stay",
        "duration_days": "3-5",
        "habitat": "Luxury station",
        "highlight": "16 sunrises a day",
        "status": "booking",
        "description": "Wake up above the clouds in a private cabin with a full orbit of Earth every 90 minutes.",
    },
    {
        "id": "lunar",
        "name": "Lunar Flyby",
        "route": "Deep-space loop",
        "highlight": "Far side of the Moon",
        "status": "coming_soon",
        "description": "A future deep-space journey around the Moon and home again.",
    },
]

SEAT_TYPES = {
    "standard": "Standard window",
    "panoramic": "Panoramic window",
    "premium": "Premium observation",
}

SEATS = []
_layout = ["standard", "standard", "panoramic", "panoramic",
           "standard", "premium", "premium", "standard",
           "panoramic", "panoramic", "standard", "standard"]
for i, seat_type in enumerate(_layout):
    row = chr(65 + i // 4)
    col = (i % 4) + 1
    SEATS.append({
        "id": f"{row}0{col}",
        "type": seat_type,
        "label": SEAT_TYPES[seat_type],
        "booked": False,
    })

BOOKINGS = []

NEXT_LAUNCH = datetime.datetime.utcnow() + datetime.timedelta(days=127, hours=8)


# --------------------------------------------------------------------------
# Routes: missions / seats / booking / countdown
# --------------------------------------------------------------------------

@app.get("/api/missions")
def get_missions():
    return jsonify(MISSIONS)


@app.get("/api/seats")
def get_seats():
    return jsonify(SEATS)


@app.post("/api/book")
def book_seat():
    data = request.get_json(silent=True) or {}
    seat_id = data.get("seat_id")
    name = data.get("name", "Anonymous Explorer")

    seat = next((s for s in SEATS if s["id"] == seat_id), None)
    if not seat:
        return jsonify({"error": "Seat not found"}), 404
    if seat["booked"]:
        return jsonify({"error": "Seat already booked"}), 409

    seat["booked"] = True
    booking = {
        "seat_id": seat_id,
        "name": name,
        "confirmation": f"AA-{random.randint(100000, 999999)}",
    }
    BOOKINGS.append(booking)
    return jsonify(booking), 201


@app.get("/api/countdown")
def get_countdown():
    remaining = (NEXT_LAUNCH - datetime.datetime.utcnow()).total_seconds()
    return jsonify({
        "target_utc": NEXT_LAUNCH.isoformat() + "Z",
        "seconds_remaining": max(0, int(remaining)),
    })


@app.get("/api/telemetry")
def get_telemetry():
    """Fake but plausible live mission telemetry for the Mission Control HUD."""
    return jsonify({
        "altitude_km": 100,
        "velocity_kms": 7.8,
        "status": "ORBITAL",
        "earth_distance_km": 400,
    })


# --------------------------------------------------------------------------
# AI integration: Orbi the mission guide
# --------------------------------------------------------------------------

ORBI_SYSTEM_PROMPT = (
    "You are Orbi, the cheerful AI mission guide for AERO ADDICTZ, a fictional "
    "commercial space tourism company. You answer questions about suborbital, "
    "orbital, and lunar (coming soon) missions, spacecraft safety, seating, "
    "training, and what spaceflight feels like. Keep answers short (2-4 "
    "sentences), warm, a little playful, and clearly aimed at someone "
    "considering booking a trip to space. Never claim any of this is real "
    "spaceflight booking — it's a demo product."
)


def call_anthropic(message: str) -> str:
    import requests
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": os.environ.get("ANTHROPIC_MODEL", "claude-3-5-haiku-latest"),
            "max_tokens": 300,
            "system": ORBI_SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": message}],
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    parts = [block["text"] for block in data.get("content", []) if block.get("type") == "text"]
    return "".join(parts).strip()


def call_openai(message: str) -> str:
    import requests
    api_key = os.environ.get("OPENAI_API_KEY")
    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
            "max_tokens": 300,
            "messages": [
                {"role": "system", "content": ORBI_SYSTEM_PROMPT},
                {"role": "user", "content": message},
            ],
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"].strip()


def rule_based_orbi(message: str) -> str:
    """Zero-dependency fallback so /api/chat always returns something useful,
    even with no API key configured at all."""
    m = message.lower()
    if any(w in m for w in ["price", "cost", "how much"]):
        return ("Suborbital starts around $250k, orbital stays are quoted per "
                "mission, and the lunar flyby is waitlist-only for now.")
    if "seat" in m:
        return ("Panoramic and premium seats book up first — check the seat "
                "map above for what's still open.")
    if any(w in m for w in ["safe", "danger", "risk"]):
        return ("Every critical system on the Comet-9 is redundant, and every "
                "traveler completes full pre-flight astronaut training first.")
    if any(w in m for w in ["gravity", "weightless", "float"]):
        return ("Zero gravity feels like the top of a swing that never comes "
                "back down — most people grin the whole time.")
    if any(w in m for w in ["moon", "lunar"]):
        return ("The lunar flyby is still in development, targeting 2032 — "
                "join the waitlist to fly on one of the first trips.")
    if any(w in m for w in ["hi", "hello", "hey"]):
        return "Hey! I'm Orbi. Ask me about missions, seats, safety, or what launch day feels like."
    return ("Good question! I'm running without a connected AI model right "
            "now, so here's the short version: AERO ADDICTZ flies suborbital "
            "hops today, orbital stays soon, and a lunar flyby down the road.")


@app.post("/api/chat")
def chat():
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "message is required"}), 400

    reply = None
    provider = "offline"
    try:
        if os.environ.get("ANTHROPIC_API_KEY"):
            reply = call_anthropic(message)
            provider = "anthropic"
        elif os.environ.get("OPENAI_API_KEY"):
            reply = call_openai(message)
            provider = "openai"
    except Exception as exc:  # network issues, bad key, rate limit, etc.
        app.logger.warning("AI provider call failed, falling back: %s", exc)
        reply = None

    if not reply:
        reply = rule_based_orbi(message)

    return jsonify({"reply": reply, "provider": provider})


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "service": "aero-addictz-backend"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)