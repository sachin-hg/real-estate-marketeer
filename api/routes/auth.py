"""Auth routes — login / token validation for the investor portal."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel

router = APIRouter(prefix="/api/auth", tags=["auth"])

_SECRET = os.environ.get("JWT_SECRET", "nava-investor-secret-change-in-prod-2026")
_ALGORITHM = "HS256"
_TOKEN_EXPIRE_HOURS = 72

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def _hash_matches(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def _make_token(username: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=_TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": username, "role": role, "exp": expire}, _SECRET, algorithm=_ALGORITHM)


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, _SECRET, algorithms=[_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str


@router.post("/login", response_model=TokenOut)
async def login(form: OAuth2PasswordRequestForm = Depends()):
    try:
        from db.connection import get_db_session
        from db.models import UserRecord
        with get_db_session() as session:
            user = session.query(UserRecord).filter_by(username=form.username, is_active=True).first()
    except Exception:
        user = None

    if not user or not _hash_matches(form.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = _make_token(user.username, user.role)
    return TokenOut(access_token=token, username=user.username, role=user.role)


@router.get("/me")
async def me(token: str = Depends(oauth2_scheme)):
    payload = _decode_token(token)
    return {"username": payload["sub"], "role": payload.get("role", "investor")}


def require_auth(token: str = Depends(oauth2_scheme)) -> dict:
    """Dependency: raises 401 if token is missing or invalid."""
    return _decode_token(token)
