"""
JWT verification for Supabase Auth tokens.

Validates the access_token from the Authorization header,
extracts the user ID and role, and enforces role-based access.
"""

from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError
from pydantic import BaseModel
from typing import List, Optional

from core.config import settings

security_scheme = HTTPBearer()


class TokenPayload(BaseModel):
    """Decoded JWT payload fields we care about."""
    sub: str  # Supabase user ID (UUID)
    email: Optional[str] = None
    role: str = "anon"  # Will be overridden by app_metadata or DB lookup
    exp: int = 0


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Security(security_scheme),
) -> TokenPayload:
    """
    Verify a Supabase JWT and return the decoded payload.
    
    In production, the role should be fetched from the `public.users` table
    (not just trusted from the JWT claim) to support instant role revocation.
    For the initial scaffold, we extract from JWT and note the TODO.
    """
    token = credentials.credentials

    if not settings.SUPABASE_JWT_SECRET:
        raise HTTPException(
            status_code=500,
            detail="JWT secret not configured. Set SUPABASE_JWT_SECRET in .env",
        )

    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid or expired token: {str(e)}",
        )

    # Extract user role from app_metadata (Supabase convention)
    # TODO: Phase 2 — fetch role from public.users table for instant revocation
    app_metadata = payload.get("app_metadata", {})
    user_role = app_metadata.get("role", payload.get("role", "reporter"))

    return TokenPayload(
        sub=payload.get("sub", ""),
        email=payload.get("email"),
        role=user_role,
        exp=payload.get("exp", 0),
    )


def require_roles(allowed_roles: List[str]):
    """
    Dependency that checks whether the authenticated user has one of the allowed roles.
    
    Usage:
        @router.get("/admin-only", dependencies=[Depends(require_roles(["admin"]))])
        async def admin_endpoint():
            ...
    """
    async def role_checker(token: TokenPayload = Depends(verify_token)):
        if token.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required roles: {allowed_roles}, your role: {token.role}",
            )
        return token
    return role_checker
