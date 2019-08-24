const express     =   require("express");
const server      =   express();
const router      =   express.Router();
const bodyParser  =   require("body-parser");


/////////////////////////////// Service
const PORT = 4000;
const TARGET_A = "http://localhost:8080/anything";
const TARGET_B = "http://127.0.0.1:8080/anything";
const TARGET_NAME_A = "target-a";
const TARGET_NAME_B = "target-b";
const SLEEPTIME = 5000;
const RESOURCE = "/resource/*";

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
    
    async call(url, target, options) {
        //remove couple of headers that can cause trouble
        delete options.headers["host"];
        delete options.headers["content-length"];

        //prepare the zipkin request-promise wrapper
        let request = new wrapRequest(tracer, target);
        console.log("calling : " + url + " with options: " + JSON.stringify(options));
        
        let result = await request(url, options)
            .catch(function(err){
                throw new Error(err);
            });
        
        console.log("sending result");
        return result;
    }

}

/////////////////////////////// Controller
class Controller {
    static instance;
    static invoker;

    constructor(){
        this.invoker = Invoker.getInstance();
    }

    static getInstance() {
        //instantiate once and only one to implement the singleton pattern
        if (!Controller.instance) {
            Controller.instance = new Controller();
        }
        return Controller.instance;
    }

    async sleep(ms) {
        return await new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async route(url, targetService, method, headers, body, sleeptime) {
        console.log(`processing [${method}] ${url}`);
        //set the call options
        let options = {
            method: method,
            headers: headers,
            json: true,
            body: body
        };

        switch(method){
        
            case "POST" : {
                // now we wait for sleeptime ms (if > 0)
                if(sleeptime>0){
                    console.log(`sleeping for ${sleeptime}ms`);
                    await this.sleep(sleeptime);
                }

            }

            default: {
                return await this.invoker.call(url, targetService, options);
            }

        }

    }

}

/////////////////////////////// Routes
const controller = Controller.getInstance();

router.get("/",function(req,res){
    res.json({"status" : "UP"});
});

router.route(RESOURCE)
    .get(async function(req,res){

        let url = TARGET_A;
        let targetService = TARGET_NAME_A;

        // to reproduce the issue we need to simulate an instrumented service calling another
        // for this we just make the service call itself only once by checking a custom header
        if(!req.headers["x-call-count"]){
            req.headers["x-call-count"]=1;
            //console.log(req);
            url = "http://" + req.headers.host + req.url;
            targetService = "self";
        }

        try{
            let response = await controller.route(url, targetService, req.method, req.headers, req.body, null);
            res.json(response);
        }
        catch (err) {
            res.json({"error":err.message});
            throw new Error(err.message);
        }

    })
    
    .post(async function(req,res){

        let url = TARGET_B;
        let targetService = TARGET_NAME_B;
        let delay = SLEEPTIME;

        // to reproduce the issue we need to simulate an instrumented service calling another
        // for this we just make the service call itself only once by checking a custom header
        if(!req.headers["x-call-count"]){
            req.headers["x-call-count"]=1;
            //console.log(req);
            url = "http://" + req.headers.host + req.url;
            targetService = "self";
            delay = 0;
        }

        try{
            let response = await controller.route(url, targetService, req.method, req.headers, req.body, delay);
            res.json(response);
        }
        catch (err) {
            res.json({"error":err.message});
            throw new Error(err.message);
        }

    });

server.use('/',router);
server.listen(PORT);
console.log(`Listening to PORT ${PORT}`);