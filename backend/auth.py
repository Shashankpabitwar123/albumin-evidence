"""Shared password, server-side sessions, and bounded login attempts."""

import hashlib
import hmac
import os
import secrets
import time
from collections import defaultdict
from fastapi import HTTPException, Request
from .db import connect

attempts = defaultdict(list)


def require_session(request: Request):
    token = request.cookies.get("evidence_session", "")
    digest = hashlib.sha256(token.encode()).hexdigest()
    with connect() as db:
        row = db.execute(
            "SELECT 1 FROM sessions WHERE token=? AND expires>?", (digest, time.time())
        ).fetchone()
    if not row:
        raise HTTPException(401, "Please sign in to continue. Your saved work is safe.")
    # Mutations require a custom header; third-party HTML forms cannot set it.
    if (
        request.method not in ("GET", "HEAD")
        and request.headers.get("X-Requested-With") != "AlbuminEvidence"
    ):
        raise HTTPException(403, "Please reload the application and try again.")


def sign_in(password, request, response):
    address = request.client.host
    attempts[address] = [t for t in attempts[address] if t > time.time() - 300]
    if len(attempts[address]) >= 8:
        raise HTTPException(429, "Too many attempts. Please wait five minutes.")
    expected = os.getenv("APP_PASSWORD", "")
    if len(expected) < 12:
        raise HTTPException(
            503, "Access is not configured. Please contact the application owner."
        )
    if not hmac.compare_digest(password.encode(), expected.encode()):
        attempts[address].append(time.time())
        raise HTTPException(401, "The password is incorrect. Please try again.")
    attempts.pop(address, None)
    token = secrets.token_urlsafe(40)
    with connect() as db:
        db.execute("DELETE FROM sessions WHERE expires<?", (time.time(),))
        db.execute(
            "INSERT INTO sessions VALUES(?,?)",
            (hashlib.sha256(token.encode()).hexdigest(), time.time() + 28800),
        )
    response.set_cookie(
        "evidence_session",
        token,
        httponly=True,
        secure=os.getenv("COOKIE_SECURE", "true") == "true",
        samesite="strict",
        max_age=28800,
    )
