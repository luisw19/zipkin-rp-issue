# zipkin-js RP Instrumentation Issue

This project reproduces an issue when instrumenting request-promise using [zipkin-js](https://github.com/openzipkin/zipkin-js) and [zipkin-instrumentation-request-promise](https://github.com/openzipkin/zipkin-js/tree/master/packages/zipkin-instrumentation-request-promise).

## Issue description

The node application in this project serves one endpoint with two methods: `[GET] /resource/` and `[POST] /resource/`. Calls to both methods are forwarded to a [httpbin](https://httpbin.org/) backend service acting echo server. More over the routes are implemented with *async* and *await* methods.

The `[POST] /resource/` endpoint introduces a **delay** of **5 seconds**. When this endpoint is invoked, the spans generated by the instrumented `request` seems to lose its *parent span ID*.

> Note that in different project (one that can't be shared publicly) a similar implementation (though modular meaning not all classes in the same `server.js` file and also based on **TypeScript**), resulted in the span generated by the delayed `[POST]`  being assigned to the parentId of that of another trace (a `[GET]` called that completed before it). Although I could not reproduce exactly that error in this project.

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

5. On a separate shell execute all the following command to generate a *get* and *post* calls:

    ```bash
    ./runTest.sh
    ```

    > this step assumes `curl` is already installed.

6. Open the `zipkin-ui` in a browser by entering the following URL <http://localhost:9411/zipkin>

7. Click search and notice that there are two traces. One with a single span and the other one with three. This is because the wrong `parentId` was assigned to the `POST` backend `target-a` service call.
