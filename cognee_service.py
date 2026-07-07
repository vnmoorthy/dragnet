"""
Optional Cognee sidecar (BONUS track).  Gives the agent real cross-session memory
of confirmed fraud typologies, backed by the SAME Neo4j instance Dragnet already uses.

Run it only if you're chasing the Cognee bonus:
    pip install cognee fastapi uvicorn
    # point Cognee at your Neo4j (see https://github.com/topoteretes/cognee)
    export GRAPH_DATABASE_PROVIDER=neo4j
    export GRAPH_DATABASE_URL=$NEO4J_URI
    export GRAPH_DATABASE_USERNAME=$NEO4J_USER
    export GRAPH_DATABASE_PASSWORD=$NEO4J_PASSWORD
    uvicorn cognee_service:app --port 8000
    # then in .env:  COGNEE_URL=http://localhost:8000

If this sidecar isn't running, src/lib/cognee.ts falls back to a local JSON memory,
so the demo still shows the "seen this before" recall.
"""
from fastapi import FastAPI
from pydantic import BaseModel
import asyncio

app = FastAPI()

try:
    import cognee  # type: ignore
    HAS_COGNEE = True
except Exception:  # noqa: BLE001
    HAS_COGNEE = False

# in-process index of signatures -> note (mirrors what we push into Cognee)
_MEM: dict[str, dict] = {}


class Remember(BaseModel):
    signature: str
    typology: str
    ringId: str
    note: str


@app.post("/remember")
async def remember(r: Remember):
    _MEM[r.signature] = {"ringId": r.ringId, "note": r.note}
    if HAS_COGNEE:
        # feed the confirmed case into the agent's brain
        await cognee.add(f"Confirmed {r.typology} ring {r.ringId}: {r.note}")
        await cognee.cognify()
    return {"ok": True, "cognee": HAS_COGNEE}


@app.get("/recall")
async def recall(signature: str):
    if HAS_COGNEE:
        try:
            results = await cognee.search("SIMILARITY", query_text=signature)
            if results:
                return {"match": str(results[0])}
        except Exception:  # noqa: BLE001
            pass
    hit = _MEM.get(signature)
    return {"match": f"{hit['ringId']}: {hit['note']}" if hit else None}


@app.get("/health")
async def health():
    return {"cognee": HAS_COGNEE}
