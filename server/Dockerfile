FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

COPY . .
RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH"

# Nothing this container does needs root. Only the two directories the compose
# file mounts volumes over are handed to the app user; the code and the venv
# stay root-owned and read-only to the process, so a file-handling bug in the
# upload path has nowhere to write that gets executed later.
#
# Those directories have to exist and be owned here, before the mount: Docker
# seeds an empty named volume from the image path behind it, ownership
# included, and a volume created against a root-owned path stays root-owned
# for good. Volumes made by an earlier build of this image predate that, so
# they need `docker compose down -v` once.
RUN useradd --system --uid 10001 --create-home app \
    && mkdir -p config/media config/staticfiles \
    && chown -R app:app config/media config/staticfiles
USER app

EXPOSE 8000

# migrate, then collectstatic (the web container serves what it writes), then
# serve. Still `runserver`: this container is the application, and swapping in
# gunicorn is a change to this one line — `gunicorn config.wsgi:application
# --bind 0.0.0.0:8000` — plus the dependency, with nothing else in the compose
# file or the web server's config needing to know. That seam is the reason the
# three services are split apart rather than combined into one image.
CMD ["sh", "-c", "python config/manage.py migrate && python config/manage.py collectstatic --noinput && python config/manage.py runserver 0.0.0.0:8000"]
