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

### Check Observability

Now it's time to check out the observability stack.

**Kiali**
In the OpenShift console UI, open 

```text
Service Mesh -> Traffic Graph 
```

Select the servicemesh-apps namespace. You see a graph of the traffic that flows through our services. The blue lines mean all traffic is going through our L4 Ztunnel. If you activate *Security* in the *Display* menu and click on the new icons on the blue lines you see we have mTLS enabled.

**Metrics**

In the OpenShift console UI, open 

```text
Observe -> Metrics
```

Enter the query `istio_tcp_connections_opened_total` and you can see that with the Thanos Querier we can access Istio metrics. At the moment we only have L4 metrics. Later we'll use a Waypoint proxy for L7 which exposes HTTP metrics like `istio_requests_total`.

**Perses Dashboard**

In the OpenShift console UI, open 

```text
Observe -> Perses Dashboards
```

And you can see the TCP traffic.

Also, if you go into 

```text
Workloads -> Deployments
```

and open for example the service-b deployment, you will have a Service Mesh tab with inbound traffic, Kiali information etc..

## L4 Security Features (Ztunnel)

Before we move to L7 with waypoint proxies, let's demonstrate what the ztunnel can already do at L4: enforce strict mTLS and identity-based authorization.

### Strict mTLS

By default, Istio ambient mode uses *permissive* mTLS — mesh workloads accept both plain-text and mTLS traffic. We can enforce that **only** mTLS traffic is allowed by applying a `PeerAuthentication` policy.

Start a temporary curl pod in the `default` namespace (which is NOT enrolled in the mesh) and one in `servicemesh-apps` (which IS in the mesh):

```bash
oc run curl-test -n default --image=curlimages/curl --restart=Never -- sleep 3600
oc run curl-test -n servicemesh-apps --image=curlimages/curl --restart=Never -- sleep 3600
```

Wait a few seconds for the pods to be running, then verify:

```bash
oc get pod curl-test -n default -o jsonpath='{.status.phase}'
oc get pod curl-test -n servicemesh-apps -o jsonpath='{.status.phase}'
```

**Test from outside the mesh (permissive):** The pod in `default` sends plain-text HTTP. In permissive mode (the default) this is **accepted**:

```bash
oc exec curl-test -n default -- curl -s -m 5 -w "\n" http://service-c.servicemesh-apps:8080/health
```

Apply the strict mTLS policy:

```bash
oc apply -f k8s/istiofeatures/mtls/peer-authentication.yml
```

**Test from outside the mesh (strict):** The same curl pod in `default` still sends plain-text HTTP, so it should now be **rejected**:

```bash
oc exec curl-test -n default -- curl -s -m 5 -w "\n" http://service-c.servicemesh-apps:8080/health
```

The connection will be reset because the ztunnel enforces mTLS and rejects plain-text traffic.

**Test from inside the mesh:** Now run the same curl from the pod in `servicemesh-apps`. The ztunnel transparently adds mTLS, so the request **succeeds**:

```bash
oc exec curl-test -n servicemesh-apps -- curl -s -m 5 -w "\n" http://service-c.servicemesh-apps:8080/health
```

You should get a healthy response. This shows that ztunnel provides zero-config mTLS for all enrolled workloads.

Clean up the strict mTLS policy and the curl pod in `default`:

```bash
oc delete -f k8s/istiofeatures/mtls/peer-authentication.yml
oc delete pod curl-test -n default
```

### L4 Authorization Policy

The ztunnel can also enforce authorization at L4 based on **SPIFFE identity** (service account). Our deployments use dedicated service accounts (`service-a`, `service-b`, `service-c`), so the ztunnel can distinguish between callers.

We'll apply a policy that only allows `service-b` to reach `service-c`. Any other caller will be denied.

Apply the authorization policy:

```bash
oc apply -f k8s/istiofeatures/l4-authz/authorization-policy.yml
```

**Test the call chain:** The normal A -> B -> C call should still work because service-b is the one calling service-c:

```bash
curl $ROUTE
```

You should still see the full chain response.

**Test from a curl pod:** The curl pod we created earlier in `servicemesh-apps` uses the `default` service account, not `service-b`. The ztunnel will **deny** the request:

```bash
oc exec curl-test -n servicemesh-apps -- curl -s -m 5 -w "\n" http://service-c.servicemesh-apps:8080/health
```

The connection will be denied by the ztunnel (RBAC: access denied). Only service-b's identity is allowed to reach service-c.

You can also verify in the ztunnel logs that the connection was denied:

```bash
oc logs -n ztunnel -l app=ztunnel --tail=50 | grep "policy rejection"
```

Clean up the authorization policy and the curl pod:

```bash
oc delete -f k8s/istiofeatures/l4-authz/authorization-policy.yml
oc delete pod curl-test -n servicemesh-apps
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

### Check pods

A waypoint proxy and the ingress gateway are deployed next to the apps:

```bash
oc get pod -n servicemesh-apps
```

Label the namespace to enroll all services of the namespace to use the waypoint:

```bash
oc label namespace servicemesh-apps istio.io/use-waypoint=waypoint
```

As apps may use a persistent HTTP connection for downstream service calls, restart the deployments to make sure they will use the waypoint proxy.

```bash
oc rollout restart deployment/service-a -n servicemesh-apps
oc rollout restart deployment/service-b -n servicemesh-apps
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

## Distributed Tracing
