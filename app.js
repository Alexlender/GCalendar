
import express from 'express'
import bodyParser from 'body-parser'
import fs from 'fs'
import util from 'util'
import MongoJs from 'mongojs'

import options from "./options.json" assert {type: "json"}

const app = express()

const host = "0.0.0.0"
const port = 3000
const connection_url = options.Mongo_string;

const Events = MongoJs(connection_url, ['Events']).Events;
const Groups = MongoJs(connection_url, ['Groups']).Groups;
const Plans = MongoJs(connection_url, ['Plans']).Plans;
const Users = MongoJs(connection_url, ['Users']).Users;


const urlencodedParser = express.urlencoded({ extended: false });

app.use(bodyParser.json())

app.use(express.static(process.cwd() + '/public'))

app.use(express.static(process.cwd() + '/public', {
  extensions: ['html']
}));


app.get('/api/events', (req, res) => {

  const arg = req.query.search;

  //const search = arg ? { text: { $regex: arg, $options: "i" } } : {};
  const search = {};
  // console.log(search)
  Users.find(search, function (err, docs) {
    res.send(docs);
  })

})



app.listen(port, host, () => {
  console.log(`Listening on http://${host}:${port}`);
});


// Схема бд

// users
// [{
//     id: "",
//     name: "",
//     login: "",
//     phone: "",
//     password: ""
// }, ...]

// groups
// [{
//     id: ""
//     owner: ""
//     events: ["event", ..]
//     plans: ["asd", ..]
// }, ...]

// events
// [{
//     id: ""
//     owner: ""
//     group_id: ""
//     description: ""
//     poll: [{id: "", status: ""}, ...]
//     date: ""
// }, ...]

// plans
// [{
//     owner: "",
//     date: "",
//     description: ""
// }, ...]