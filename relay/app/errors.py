class AuthError(Exception):
    """Bambu rejected the token or credentials."""


class UpstreamError(Exception):
    """Bambu API or broker unreachable, timed out, or returned something unusable."""
