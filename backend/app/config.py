from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "养薯户 API"
    database_url: str = "sqlite:///./yangshuhu.db"
    secret_key: str = "change-this-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_pro_monthly_price_id: str = ""
    stripe_pro_yearly_price_id: str = ""
    stripe_team_monthly_price_id: str = ""
    stripe_team_yearly_price_id: str = ""
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    # Email settings (Resend)
    resend_api_key: str = ""
    email_from: str = "noreply@yangshuhu.com"
    # OAuth settings
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:3000/api/auth/callback/google"
    github_client_id: str = ""
    github_client_secret: str = ""
    github_redirect_uri: str = "http://localhost:3000/api/auth/callback/github"
    # Frontend URL
    frontend_url: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


settings = Settings()
