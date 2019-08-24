#!/bin/bash

curl -X POST localhost:4000/resource/f562261c-2f99-48b8-b661-43dc2113dcdf/ -d '{"some":"value"}' -H "Content-Type: application/json" \
& sleep 2 && curl localhost:4000/resource/;