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
while true; do curl $ROUTE; sleep 2; done
```

## Waypoint Proxy and Gateway

At the moment we route traffic through a standard OpenShift Route into the mesh. We want to use a Gateway instead. And we only have Service Mesh functionality up to Level 4 in the network stack with our ZTunnel. For L7 features we have to run some waypoint proxies.

### Level 7 features (require Waypoint proxy)

* **Traffic management**  
Advanced HTTP routing, load balancing, circuit breaking, rate limiting, fault injection, retries, timeouts
* **Security**  
Authorization policies based on L7 attributes such as request type or HTTP headers
* **Observability**  
HTTP metrics, access logging and tracing

### Ingress Gateway

Create the Gateway and HTTPRoute:

```bash
oc apply -f k8s/apps_gateway_waypoint/gateway.yml
```

And we expose the Gateway and delete our old Route to service-a:

```bash
oc apply -f k8s/apps_gateway_waypoint/gateway-route.yml
oc -n servicemesh-apps delete route service-a
```

### Waypoint Proxy

Create the waypoint proxy:

```bash
oc apply -f k8s/apps_gateway_waypoint/waypoint_proxy.yml
```

Label the namespace to enroll all services of the namespace to use the waypoint:

```bash
oc label namespace servicemesh-apps istio.io/use-waypoint=travel-control-waypoint
```

Istio is sending traffic from the gateway directly to the destination, if not instructed otherwise. We have to label the service to enable **ingress waypoint routing**:

```bash
oc -n servicemesh-apps label service service-a istio.io/ingress-use-waypoint="true"
```

Finally we have to create the waypoint routing:

```bash
oc apply -f k8s/apps_gateway_waypoint/waypoint_routing.yml
```

### Check pods

A waypoint proxy and the ingress gateway are deployed next to the apps:

```bash
oc get pod -n servicemesh-apps
```

The route to our ingress gateway is:

```bash
echo "https://$(oc get route -n servicemesh-apps apps-gateway -o jsonpath='{.spec.host}')"
```

## Check metrics

Now create some traffic and then it's a good time to check the Kiali and Distributed Tracing console.

```bash
export ROUTE="https://$(oc get route -n servicemesh-apps apps-gateway -o jsonpath='{.spec.host}')"
while true; do curl $ROUTE; sleep 3; done
```

URL to Kiali (or just use the Kiali console in the OpenShift console UI):
```bash
echo "https://$(oc get route -n istio-system kiali -o jsonpath='{.spec.host}')"
```

Tempostack Distributed Tracing UI:
```bash
echo "https://$(oc get route -n tempostack tempo-tempostack-query-frontend -o jsonpath='{.spec.host}')"
```