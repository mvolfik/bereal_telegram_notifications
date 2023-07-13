FROM denoland/deno:debian

WORKDIR /app

COPY server.deno.ts tgbot.deno.ts ./
RUN deno cache server.deno.ts

CMD ["run", "--allow-all", "server.deno.ts"]
