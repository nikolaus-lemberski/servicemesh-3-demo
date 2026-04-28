package com.lemberski.servicec;

import static jakarta.ws.rs.core.Response.Status.INTERNAL_SERVER_ERROR;
import static java.lang.String.format;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/")
public class App {

    @ConfigProperty(name = "HOSTNAME", defaultValue = "localhost")
    String HOSTNAME;

    @ConfigProperty(name = "VERSION", defaultValue = "v1")
    String VERSION;

    private boolean crash = false;
    private int count = 0;

    @GET
    @Produces(MediaType.TEXT_PLAIN)
    public Response sayHello() {
        if (crash) {
            return Response.status(INTERNAL_SERVER_ERROR)
                    .entity(INTERNAL_SERVER_ERROR.name())
                    .build();
        }

        count++;
        String response = format("Service C | %s | %s | %d", VERSION, hostname(), count);
        return Response.ok(response).build();
    }

    @GET
    @Path("/crash")
    @Produces(MediaType.TEXT_PLAIN)
    public String activateCrash() {
        crash = true;
        return "Crash mode activated";
    }

    @GET
    @Path("/repair")
    @Produces(MediaType.TEXT_PLAIN)
    public String deactivateCrash() {
        crash = false;
        return "Crash mode deactivated";
    }

    @GET
    @Path("/health")
    @Produces(MediaType.TEXT_PLAIN)
    public String health() {
        return "UP";
    }

    private String hostname() {
        String dash = "-";
        if (HOSTNAME.contains(dash)) {
            return HOSTNAME.substring(HOSTNAME.lastIndexOf(dash) + 1);
        }

        return HOSTNAME;
    }

}
