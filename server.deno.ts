import {
  handleRequest as handleTgRequest,
  init,
  webhookPath,
} from "./tgbot.deno.ts";

async function handleHttp(conn: Deno.Conn) {
  for await (const e of Deno.serveHttp(conn)) {
    const start = performance.now();

    const mockEvent: Deno.RequestEvent = {
      request: e.request,
      async respondWith(r) {
        const resp = await r;
        const end = performance.now();
        console.log(
          `${new Date().toISOString()} ${resp.status} ${e.request.method} ${
            e.request.url
          } ${(end - start).toFixed(1)}ms`
        );
        return await e.respondWith(resp);
      },
    };

    handleEvent(mockEvent)
      .then(async (response) => {
        if (response !== null) {
          await mockEvent.respondWith(response);
        }
      })
      .catch((err) => console.error(err));
  }
}

async function handleEvent(e: Deno.RequestEvent): Promise<Response | null> {
  const url = new URL(e.request.url);
  if (url.pathname === webhookPath) {
    await handleTgRequest(e);
    return null;
  }

  return new Response("t.me/bereal_notifications", {
    status: 301,
    headers: {
      location: "https://t.me/bereal_notifications",
      "content-type": "text/plain",
    },
  });
}

await init();

for await (const conn of Deno.listen({ port: 8000 }))
  handleHttp(conn).catch((err) => console.error(err));
