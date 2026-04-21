# Using the Service Mesh

Create the apps namespace, create a pod monitor (every namespace of the mesh needs a pod monitor) and the apps:

```bash
oc apply -k k8s/apps
```

Get the route and check if the apps are available.

```bash
export ROUTE="https://$(oc get route -n servicemesh-apps service-a -o jsonpath='{.spec.host}')"
curl $ROUTE
```

You should see something like

```text
Service A <- Service B <- Service C | v1 | 5vnhc | 1
```

with round robin to v1 and v2 of Service C.