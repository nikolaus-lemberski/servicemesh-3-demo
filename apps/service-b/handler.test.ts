import { extractTracingHeaders } from "./handler";

describe("Handler Tests", () => {
    test("test extract tracing headers", () => {
        const expected1: string[] = ["x-request-id", "X-Request-ID"];
        const expected2: string[] = ["x-b3-traceid", "X-B3-TraceId"];
        const expected3: string[] = ["traceparent", "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01"];
        const expected4: string[] = ["tracestate", "congo=t61rcWkgMzE"];

        const headers: any = {
            [expected1[0]]: expected1[1],
            [expected2[0]]: expected2[1],
            [expected3[0]]: expected3[1],
            [expected4[0]]: expected4[1],
            "foo": "bar"
        };

        const tracing_headers = extractTracingHeaders(headers);
        
        expect(tracing_headers).toHaveLength(4);
        expect(tracing_headers.toString()).toContain(expected1[0]);
        expect(tracing_headers.toString()).toContain(expected1[1]);
        expect(tracing_headers.toString()).toContain(expected2[0]);
        expect(tracing_headers.toString()).toContain(expected2[1]);
        expect(tracing_headers.toString()).toContain(expected3[0]);
        expect(tracing_headers.toString()).toContain(expected3[1]);
        expect(tracing_headers.toString()).toContain(expected4[0]);
        expect(tracing_headers.toString()).toContain(expected4[1]);
    });
});
