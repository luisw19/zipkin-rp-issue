# zipkin-rp-issue

This project reproduces an issue when instrumenting request-promise using [zipkin-js](https://github.com/openzipkin/zipkin-js) and [zipkin-instrumentation-request-promise](https://github.com/openzipkin/zipkin-js/tree/master/packages/zipkin-instrumentation-request-promise).

## Issue description

The node application in this project serves one endpoint with two methods: `[GET] /` and `[POST] /`. Calls to both methods are forwarded to a [httpbin](https://httpbin.org/) backend service acting echo server.

The issue occurs a given call (e.g. a call to `[POST] /`) takes longer to be routed to the backend than a newer call (e.g. a call to `[GET] /`).

In short, the issue is that the *span* generated for the slowest call by the instrumented `request-promise` invocation, takes the `parentId` of the newer call (`[GET] /` and not the one from the previous call (`[POST] /`).

## Reproduce

Follow this steps to reproduce the error:

1. Start up the local environment containing *zipkin* and the *backend httpbin service* using `docker-compose` as following.

```bash
docker-compose up -d
```
