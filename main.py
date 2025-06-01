# main.py

import os
import re
import json
import logging
from dotenv import load_dotenv
from fastapi import FastAPI, Form, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from google import genai

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    logging.critical("GEMINI_API_KEY not set in .env")
    raise RuntimeError("GEMINI_API_KEY not set in .env")

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)
logger.info("Starting Palettr FastAPI application")

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def root():
    logger.info("Serving index.html for GET /")
    return FileResponse("static/index.html")

def strip_code_fences(text: str) -> str:
    pattern = r"^\s*```(?:json)?\s*\n?|\n?\s*```$"
    return re.sub(pattern, "", text, flags=re.MULTILINE)

@app.post("/api/palettes", response_class=JSONResponse)
async def generate_palettes(
    request: Request,
    user_prompt: str = Form(...),
    tags: str = Form(""),
    count: int = Form(None)
):
    num_palettes = count if (count and count > 0) else 6
    logger.info(f"Received /api/palettes request: prompt='{user_prompt}', tags='{tags}', count={num_palettes}")

    gemini_prompt = (
        f"Generate {num_palettes} distinct color palettes (each a list of 3–6 hex colors) for the "
        f"theme: '{user_prompt}'. Tag: {tags if tags else 'none'}. "
        f"Also provide a brief explanation of why these palettes suit the theme. "
        "Respond in JSON with keys \"reasoning\" (string) and \"palettes\" (array of arrays)."
        "\nFormat:\n"
        "{\n"
        '  "reasoning": "Your reasoning text here",\n'
        '  "palettes": [ ["#FF5733","#C70039","#900C3F"], ... ]\n'
        "}\n\n"
        "Output only valid JSON—no extra text."
    )

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        chat = client.chats.create(model="gemini-2.0-flash")
        response = chat.send_message(gemini_prompt)
        raw_text = response.text
        logger.debug(f"Raw Gemini response: {raw_text}")
    except Exception as e:
        logger.error(f"Gemini API call failed: {e}")
        return JSONResponse(status_code=500, content={"error": f"Gemini API error: {e}"})

    cleaned = strip_code_fences(raw_text)
    try:
        data = json.loads(cleaned)
        reasoning = data.get("reasoning", "")
        palettes = data.get("palettes", [])
        logger.info(f"Generated {len(palettes)} palettes; reasoning length {len(reasoning)} chars")
    except json.JSONDecodeError as jde:
        logger.error(f"JSON decode failed: {jde} | Cleaned: {cleaned}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to parse Gemini response", "raw": cleaned}
        )

    return JSONResponse(content={"reasoning": reasoning, "palettes": palettes})

@app.get("/health")
async def health_check():
    logger.info("Health check requested")
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    logger.info("Launching Uvicorn server on port 8000")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
