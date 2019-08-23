const express     =   require("express");
const server      =   express();
const router      =   express.Router();
const bodyParser  =   require("body-parser");


/////////////////////////////// Common
const PORT = 3000;
const TARGET = "http://localhost:8080/anything";
const SLEEPTIME = 5000;

/////////////////////////////// Zipkin
const localServiceName = "service";
const zipkinServer = "localhost";
const zipkinPort= "9411";
const zipkinSamplingRate = 1;

const zipkinMiddleware = require('zipkin-instrumentation-express').expressMiddleware;
const {wrapRequest} = require('zipkin-instrumentation-request-promise');
const { Tracer, BatchRecorder, sampler, jsonEncoder: {JSON_V2} } = require('zipkin');
const {HttpLogger} = require('zipkin-transport-http');
const CLSContext = require('zipkin-context-cls');
const ctxImpl = new CLSContext('zipkin');

// base URL
const zipkinBaseUrl = `http://${zipkinServer}:${zipkinPort}`;
console.log(`Setting zipkin to: ${zipkinBaseUrl} with zipkinSamplingRate=${zipkinSamplingRate}`);

const httpLogger = new HttpLogger({
  endpoint: `${zipkinBaseUrl}/api/v2/spans`,
  jsonEncoder: JSON_V2
});

// This is a hack that lets you see the data sent to Zipkin!

function recorder() {
  const logger = {
    logSpan: (span) => {
      const json = JSON_V2.encode(span);
      console.log(`reporting: ${json}`);
      httpLogger.logSpan(span);
    }
  };
  const batchRecorder = new BatchRecorder({logger});
  // This is a hack that lets you see which annotations become which spans
  return ({
    record: (rec) => {
      const {spanId, traceId} = rec.traceId;
      console.log(`recording: ${traceId}/${spanId} ${rec.annotation.toString()}`);
      batchRecorder.record(rec);
    }
  });
}

const tracer = new Tracer({
  ctxImpl, 
  recorder: recorder(), 
  sampler: new sampler.CountingSampler(zipkinSamplingRate),
  localServiceName
});

/////////////////////////////// Express middlewares
server.use( bodyParser.json() );
server.use( bodyParser.urlencoded({"extended" : false}) );
server.use( zipkinMiddleware({tracer}) );

/////////////////////////////// Invoker
class Invoker {
    static instance;
    constructor(){}

    static getInstance() {
        //instantiate once and only one to implement the singleton pattern
        if (!Invoker.instance) {
          Invoker.instance = new Invoker();
        }
        return Invoker.instance;
    }
    
    async call(url, options) {
        //prepare the zipkin request-promise wrapper
        let remoteServiceName = url.split("/")[2].split(":")[0];
        let request = new wrapRequest(tracer, remoteServiceName);
        console.log("calling : " + url + " with options: " + JSON.stringify(options));

        return await request(url, options);
    }

    async sleep(ms) {
        return await new Promise(resolve => setTimeout(resolve, ms));
    }

}
const invoker = Invoker.getInstance();

/////////////////////////////// Routes
router.get("/",function(req,res){
    res.json({"message" : "Hello World"});
});

router.route("/resource")

    .get(function(req,res){
        console.log('processing call: ', req);
        //set the call options
        let options = {
            method: req.method,
            headers: req.headers,
            json: true
        };
        invoker.call(TARGET, options)
            .then(function(body) {
                    //return body;
                    res.json( body );
                    //return;
                }
            );
    })

    .post(function(req,res){
        console.log('processing call: ', req);
        //set the call options
        let options = {
            method: req.method,
            headers: req.headers,
            json: true,
            body: req.body
        };

        // now we wait for TIMEOUT ms
        console.log(`sleeping for ${SLEEPTIME}ms}`);
        invoker.sleep(SLEEPTIME).then(function(){
            console.log(`finished sleeping`);
            invoker.call(TARGET, options).then(function(body) {
                //return body;
                res.json( body );
            });
        });

    });

server.use('/',router);
server.listen(PORT);
console.log(`Listening to PORT ${PORT}`);