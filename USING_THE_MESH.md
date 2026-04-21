# Using the Service Mesh

Create the apps namespace, create a pod monitor (every namespace of the mesh needs a pod monitor) and the apps:

```bash
oc apply -k k8s/apps
```

Get the route and check if the services are available.

```bash
export ROUTE="https://$(oc get routes -n servicemesh-apps service-a -o jsonpath='{.spec.host}')"
curl $ROUTE
```

