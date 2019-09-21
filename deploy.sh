#!/bin/bash

docker build . -t gcr.io/mechmania2017/runtime-log-pull:latest
docker push gcr.io/mechmania2017/runtime-log-pull:latest
kubectl apply -f app.yaml
kubectl delete pods -l app=runtime-log-pull