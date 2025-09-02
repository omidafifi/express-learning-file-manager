const express = require("express");
const app = express();
const PORT = 3000;

app.get("/", (req, res) => res.send("Hello Express")); //home

app.get("/users", (req, res) => {
  const users = [
    {
      name1: "omid",
      age: 34,
      name2: "ahmad",
      age: 25,
      name3: "farhad",
      age: 44,
    },
  ];
  res.send(users);
});

app.listen(PORT, () => {
  console.log(`click to join localhost http://localhost:${PORT}`);
});
