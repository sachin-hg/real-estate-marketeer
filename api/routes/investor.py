"""Investor interest — captures show-interest submissions and mails the team."""
from __future__ import annotations
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/api/investor", tags=["investor"])
logger = logging.getLogger(__name__)


class InterestRequest(BaseModel):
    name: str
    email: str
    company: str | None = None
    message: str | None = None


@router.post("/interest")
async def show_interest(req: InterestRequest):
    """Log investor interest; extend with email sending when SMTP creds are available."""
    logger.info(
        "INVESTOR_INTEREST name=%s email=%s company=%s msg=%s",
        req.name, req.email, req.company or "", (req.message or "")[:200],
    )
    # TODO: send email via SMTP/SendGrid when credentials are configured
    return {"status": "received", "message": "We'll be in touch soon."}
