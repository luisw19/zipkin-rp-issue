# zipkin-js RP Instrumentation Issue

This project reproduces an issue when instrumenting request-promise using [zipkin-js](https://github.com/openzipkin/zipkin-js) and [zipkin-instrumentation-request-promise](https://github.com/openzipkin/zipkin-js/tree/master/packages/zipkin-instrumentation-request-promise).

## Issue description

The node application in this project serves one endpoint with two methods: `[GET] /` and `[POST] /`. Calls to both methods are forwarded to a [httpbin](https://httpbin.org/) backend service acting echo server.

The issue occurs a given call (e.g. a call to `[POST] /`) takes longer to be routed to the backend than a newer call (e.g. a call to `[GET] /`).

In short, the issue is that the *span* generated for the slowest call by the instrumented `request-promise` invocation, takes the `parentId` of the newer call (`[GET] /` and not the one from the previous call (`[POST] /`).

## Reproduce

Follow this steps to reproduce the error:

1. Clone the project:

    ```bash
    git clone https://github.com/luisw19/zipkin-rp-issue.git
    ```

2. `cd` into the project folder and install all node dependencies:

    ```bash
    cd zipkin-rp-issue
    npm install
    ```

3. Start up the local environment with `docker-compose` as following.

    ```bash
    docker-compose up -d
    ```

    > Docker-compose will start the *zipkin* containers as well as a backend *httpbin* service.

4. Start the node server.

    ```bash
    npm start
    ```

5. On a separate shell execute all of the following commands at once:

    ```bash
    curl -X POST localhost:3000/resource -d '{"some":"value"}' -H "Content-Type: application/json"
    sleep 2
    curl localhost:3000/resource
    ```

    > this step assumes `curl` is already installed.

6. Open the `zipkin-ui` in a browser by entering the following URL <http://localhost:9411/zipkin>

7. Click search and notice that there are two traces. One with a single span and the other one with three. This is because the wrong `parentId` was assigned to the `POST` backend `target-a` service call.
