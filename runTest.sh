#!/bin/bash

curl -X POST localhost:3000/resource -d '{"some":"value"}' -H "Content-Type: application/json";
sleep 2;
curl localhost:3000/resource;