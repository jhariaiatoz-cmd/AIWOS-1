import logging

logger = logging.getLogger(__name__)


class EmailService:
    async def send_invitation(
        self,
        to_email: str,
        org_name: str,
        role: str,
        invite_url: str,
        invited_by_name: str,
    ) -> None:
        logger.info(
            "Invitation email | to=%s org=%s role=%s url=%s",
            to_email,
            org_name,
            role,
            invite_url,
        )
        separator = "=" * 60
        print(f"\n{separator}")
        print("INVITATION EMAIL (console fallback — wire up SMTP to send real emails)")
        print(f"To:           {to_email}")
        print(f"Invited by:   {invited_by_name}")
        print(f"Organization: {org_name}")
        print(f"Role:         {role}")
        print(f"Accept link:  {invite_url}")
        print(f"{separator}\n")


email_service = EmailService()
