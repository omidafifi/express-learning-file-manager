const express = require("express");
const PORT = 3000;
const app = express();

app.get("/", (req, res) => {
  res.send("Hello Exprees");
});

app.get("/users", (req, res) => {
  const users = [
    {
      name1: "omid",
      age: 34,
      name2: "Zahra",
      age: 30,
    },
  ];
  res.send(users);
});

app.listen(PORT, () => {
  console.log(`click to run localhost:http://localhost${PORT}`);
});
