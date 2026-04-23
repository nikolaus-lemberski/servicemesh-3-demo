# Using the Service Mesh

We're using the Service Mesh in ambient mode (L4), sidecar mode (L7) and ambient + waypoint proxies (L7).

* **Ztunnel**  
Handles L4 (TCP) traffic management, primarily security. It provides connection-level load balancing, mTLS encryption (using HBONE), and L4 authorization. It does not read HTTP headers.
* **Waypoint Proxy**  
Handles L7 (HTTP/gRPC) traffic management. This is where the advanced, application-aware features are enabled.

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

At the moment, the apps are known to the mesh (because we have the label *istio-discovery: enabled* on the namespace), but not onboarded yet. You can verify that by checking the pods (no sidecars deployed) and the Ztunnel:

```bash
istioctl ztunnel-config workload -n ztunnel
```

The apps in the *servicemesh-apps* namespace are listed, but there's no waypoint proxy and the protocol is **TCP** (should be **HBONE** in ambient mesh). We can label the namespace to add it to the mesh:

```bash
oc label namespace servicemesh-apps istio.io/dataplane-mode=ambient
```

And checking the Ztunnel again, we can see that the protocol switched to **HBONE**.

```bash
istioctl ztunnel-config workload -n ztunnel
```

If you check the Kiali Traffic Graph (Kiali console or integrated Kiali console in your OpenShift UI Console), you can see the service calls. As the Kiali traffic graph is built from real traffic, generate some with

```bash
while true; do curl $ROUTE; sleep 2; done
```

## Waypoint Proxy and Gateway

At the moment we route traffic through a standard OpenShift Route into the mesh. We want to use a Gateway instead. And we only have Service Mesh functionality up to Level 4 in the network stack with our Ztunnel. For L7 features we have to run some waypoint proxies.

### Level 7 features (require Waypoint proxy)

* **Traffic management**  
Advanced HTTP routing, load balancing, circuit breaking, rate limiting, fault injection, retries, timeouts
* **Security**  
Authorization policies based on L7 attributes such as request type or HTTP headers
* **Observability**  
HTTP metrics, access logging and tracing

### Ingress Gateway

Create the Gateway and expose it via OpenShift Route. We delete our old Route as we're using the Gateway from now on.

```bash
oc apply -f k8s/apps_gateway_waypoint/gateway.yml
oc -n servicemesh-apps delete route service-a
```

And we create the HTTPRoute to Service A:

```bash
oc apply -f k8s/apps_gateway_waypoint/service-a-httproute.yml
```

Test the routing:

```bash
export ROUTE="https://$(oc get route -n servicemesh-apps apps-gateway -o jsonpath='{.spec.host}')"
curl $ROUTE
```

#### Testing without Waypoint Proxy

Now generate some traffic with

```bash
while true; do curl $ROUTE; sleep 3; done
```

Open Kiali

```bash
echo "https://$(oc get route -n istio-system kiali -o jsonpath='{.spec.host}')"
```

And check the *Traffic Graph* for the namespace *servicemesh-apps*. You can see that the traffic is routed from the Gateway through all services. The traffic connection lines are blue, which means all traffic is going through the Ztunnel and we have Service Mesh functionality up to L4 of the network stack.

### Waypoint Proxy

For L7 functionality we create a waypoint proxy:

```bash
oc apply -f k8s/apps_gateway_waypoint/waypoint_proxy.yml
```

Label the namespace to enroll all services of the namespace to use the waypoint:

```bash
oc label namespace servicemesh-apps istio.io/use-waypoint=waypoint
```

Istio is sending traffic from the gateway directly to the destination, if not instructed otherwise. We have to label the service the gateway uses to enable **ingress waypoint routing**:

```bash
oc -n servicemesh-apps label service service-a istio.io/ingress-use-waypoint=true
```

#### Testing with Waypoint Proxy

Again, generate some traffic with

```bash
while true; do curl $ROUTE; sleep 3; done
```

In Kiali wait for the traffic data coming in and check the *Traffic Graph* for the namespace *servicemesh-apps*. You can see that the traffic is routed from the Gateway through all services. The traffic connection lines are changing to green, which means the traffic is going through the waypoint proxy and we have Service Mesh functionality up to L7 of the network stack.

Also, we have consistent round robin to both versions of service-c.

### Check pods

A waypoint proxy and the ingress gateway are deployed next to the apps:

```bash
oc get pod -n servicemesh-apps
```

## Distributed Tracing

Tempostack Distributed Tracing UI:
```bash
echo "https://$(oc get route -n tempostack tempo-tempostack-query-frontend -o jsonpath='{.spec.host}')"
```