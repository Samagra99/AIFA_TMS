"""Custom JWT authentication that validates token_version claim."""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class FTOJWTAuthentication(JWTAuthentication):
    """
    Extends simplejwt to check token_version on every request.
    Calling user.invalidate_all_tokens() bumps token_version,
    immediately invalidating all outstanding JWTs for that user.
    """
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        token_version = validated_token.get("token_version")
        if token_version is not None and token_version != user.token_version:
            raise InvalidToken("Token has been invalidated.")
        return user
