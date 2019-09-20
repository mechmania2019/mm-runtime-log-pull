#!/bin/bash

docker build . -t gcr.io/mechmania2017/mm-runtime-log-pull:latest
docker push gcr.io/mechmania2017/mm-runtime-log-pull:latest
kubectl apply -f app.yaml
kubectl delete pods -l app=mm-runtime-log-pull