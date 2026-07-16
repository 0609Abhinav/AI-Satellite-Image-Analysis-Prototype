from redis import Redis

from app.core.config import settings


class RedisClient:
    def __init__(self, url: str) -> None:
        self.url = url
        self.client = Redis.from_url(url, decode_responses=True)

    def ping(self) -> bool:
        return bool(self.client.ping())

    def set_status(self, key: str, value: str, *, ttl_seconds: int = 3600) -> None:
        self.client.set(key, value, ex=ttl_seconds)


redis_client = RedisClient(settings.redis_url)
