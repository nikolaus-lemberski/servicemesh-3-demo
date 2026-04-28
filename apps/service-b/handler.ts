import { Request, Response } from 'express';

async function indexHandler(req: Request, res: Response): Promise<void> {
    try {
        const headers = extractTracingHeaders(req.headers);
        const service_c_host = process.env.SERVICE_C_HOST || "service-c:8080";

        const headersObj: Record<string, string> = {};
        headers.forEach(([key, value]) => {
            headersObj[key] = value;
        });

        const text = await fetch(`http://${service_c_host}`, { headers: headersObj })
            .then((response) => handleErrors(response))
            .then((response) => response.text())
            .catch((err: Error) =>
                err instanceof TypeError ? (err as TypeError).message : err.toString()
            );

        res.status(200).send(`Service B <- ${text}`);
    } catch (error) {
        res.status(500).send(`Error: ${error}`);
    }
}

function healthHandler(req: Request, res: Response): void {
    res.status(200).send("UP");
}

async function handleErrors(response: globalThis.Response): Promise<globalThis.Response> {
    if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
    }
    return response;
}

function extractTracingHeaders(req_headers: any): string[][] {
    const tracing_headers: string[] = [
        "x-request-id",
        "x-b3-traceid",
        "x-b3-spanid",
        "x-b3-parentspanid",
        "x-b3-sampled",
        "x-b3-flags",
        "traceparent",
        "tracestate",
    ];

    const headers: string[][] = tracing_headers
        .filter((tracing_header) => req_headers[tracing_header] != null)
        .map((tracing_header) => [tracing_header, req_headers[tracing_header]])
        .filter((arr): arr is string[] => arr != null);

    return headers;
}

export { indexHandler, healthHandler, extractTracingHeaders };
