const express     =   require("express");
const server      =   express();
const bodyParser  =   require("body-parser");
const router      =   express.Router();

/////////////////////////////// Common
PORT = 3000;
TARGET = "http://localhost:8080/anything";

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
    constructor(){}
    
    async call(url, options){
        //prepare the zipkin request-promise wrapper
        let remoteServiceName = url.split("/")[2].split(":")[0];
        let request = new wrapRequest(tracer, remoteServiceName);
        options.json = true;
        console.log("calling : " + url + " with options: " + JSON.stringify(options));
        return await request(url, options);
    }
}
  
const invoker = new Invoker();


/////////////////////////////// Routes
router.get("/",function(req,res){
    //set the call options
    let options = {
        method: req.method,
        headers: req.headers
      };
    res.json( invoker.call(TARGET, options) );
});

router.post("/",function(req,res){
    //set the call options
    let options = {
        method: req.method,
        headers: req.headers,
        body: req.body
      };
    res.json( invoker.call(TARGET, options) );
});

server.listen(PORT);
console.log(`Listening to PORT ${PORT}`);