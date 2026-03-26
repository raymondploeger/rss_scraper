import express from "express";

console.log("BOOTING MINIMAL START.JS SERVER");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (_request, response) => {
  response.status(200).type("text/plain").send("START.JS OK");
});

app.get("/api/health", (_request, response) => {
  response.status(200).json({ ok: true, status: "startjs-ok" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`LISTENING ON PORT ${PORT}`);
});
