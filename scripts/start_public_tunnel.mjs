import localtunnel from "../frontend/node_modules/localtunnel/localtunnel.js";

const tunnel = await localtunnel({ port: 8000 });
console.log(tunnel.url);

process.on("SIGINT", () => {
  tunnel.close();
  process.exit(0);
});
