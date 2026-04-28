# Service C

Simple service with crash simulation using Quarkus and Java 21.

Endpoints:

* "/"
* "/health"
* "/crash"
* "/repair"

## Running the application in dev mode

You can run your application in dev mode that enables live coding using:

```shell script
./mvnw quarkus:dev
```

> **_NOTE:_**  Quarkus now ships with a Dev UI, which is available in dev mode only at <http://localhost:8080/q/dev/>.

### Container image

Use provided Containerfile to create a container image.