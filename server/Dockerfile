FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

COPY . .
RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

# migrate, then collectstatic (the web container serves what it writes), then
# serve. Still `runserver`: this container is the application, and swapping in
# gunicorn is a change to this one line — `gunicorn config.wsgi:application
# --bind 0.0.0.0:8000` — plus the dependency, with nothing else in the compose
# file or the web server's config needing to know. That seam is the reason the
# three services are split apart rather than combined into one image.
CMD ["sh", "-c", "python config/manage.py migrate && python config/manage.py collectstatic --noinput && python config/manage.py runserver 0.0.0.0:8000"]
