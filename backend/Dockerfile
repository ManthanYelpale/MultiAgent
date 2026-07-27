FROM python:3.12-slim

# Don't write .pyc, unbuffered stdout for real-time logs.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Runtime lib for psycopg2.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --default-timeout=1000 --retries=10 --index-url https://download.pytorch.org/whl/cpu torch \
    && pip install --no-cache-dir --default-timeout=1000 --retries=10 -r requirements.txt \
    && pip install --no-cache-dir gunicorn==22.0.0

COPY . .

# Run as an unprivileged user rather than root.
RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /app/uploads \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/api/v1/health').status==200 else 1)"

# Gunicorn with uvicorn workers: multiple processes, so one blocking request no longer
# stalls the whole API. Tune WEB_CONCURRENCY per host.
CMD ["sh", "-c", "gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w ${WEB_CONCURRENCY:-4} -b 0.0.0.0:8000 --timeout 120"]
