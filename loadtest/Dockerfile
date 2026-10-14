# Load-test image: the backend image (Django, the models, the Docker CLI) plus
# Locust and the qonnectra_loadtest package. Compose builds it on top of the
# freshly built backend image (additional_contexts: backend: service:backend).
FROM backend

RUN pip install --no-cache-dir locust==2.46.7

WORKDIR /loadtest
COPY qonnectra_loadtest ./qonnectra_loadtest

ENV PYTHONPATH=/loadtest:/app \
    LOADTEST_RUNS=/loadtest/runs

EXPOSE 8089

CMD ["locust", "-f", "qonnectra_loadtest/locustfile.py", \
     "--class-picker", "--web-base-path", "/loadtest/runner", \
     "--users", "60", "--spawn-rate", "2"]
