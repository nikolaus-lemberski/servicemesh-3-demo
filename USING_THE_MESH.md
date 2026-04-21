# Using the Service Mesh

## Install the apps

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

We have 3 apps in a row, app A calls app B and app B calls app C. The response of all downstream calls is added to the response of the first service A.

## Onboard the apps to the Service Mesh

At the moment, the apps are known to the mesh (because we have the label *istio-discovery: enabled* on the namespace), but not onboarded yet. You can verify that by checking the pods (no sidecars deployed) and the ZTunnel:

```bash
istioctl ztunnel-config workload -n ztunnel
```

The apps in the *servicemesh-apps* namespace are listed, but there's no waypoint proxy and the protocol is **TCP** (should be **HBONE** in ambient mesh). We can label the namespace to add it to the mesh:

```bash
oc label namespace servicemesh-apps istio.io/dataplane-mode=ambient
```

And checking the ZTunnel again, we can see that the protocol switched to **HBONE**.

```bash
istioctl ztunnel-config workload -n ztunnel
```

If you check the Kiali Traffic Graph (Kiali console or integrated Kiali console in your OpenShift UI Console), you can see the service calls. As the Kiali traffic graph is built from real traffic, generate some with

```bash
while true; do curl $ROUTE; sleep 5; done
```
