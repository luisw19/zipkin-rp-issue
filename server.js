var express     =   require("express");
var app         =   express();
var bodyParser  =   require("body-parser");
var router      =   express.Router();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({"extended" : false}));

router.get("/",function(req,res){
    res.json({"method" : "GET", "URL":req});
});

router.post("/",function(req,res){
    res.json({"method" : "GET", "URL":req});
});

app.listen(3000);
console.log("Listening to PORT 3000");