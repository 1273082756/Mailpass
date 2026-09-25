ARG UV_IMAGE=dockerproxy.net/astral/uv:python3.11-bookworm-slim
FROM ${UV_IMAGE}

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev

COPY app ./app
RUN mkdir -p /data

EXPOSE 8000 2525
CMD ["uv", "run", "--no-dev", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
