# zipkin-rp-issue

This project reproduces an issue when instrumenting request-promise.

To reproduce the issue follow this steps:

1. Start the local `docker-compose` environment that contains *zipkin* and a `service mock`.

```bash
docker-compose up -d
```
